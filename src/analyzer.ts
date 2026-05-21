import * as fs from 'fs';
import * as path from 'path';

export interface AnalysisResult {
  languages: string[];
  manifests: string[];
  dependencies: string[];
  envVars: string[];
  hasEndpoints: boolean;
  endpoints: string[];
}

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.env',
  'venv',
  'env',
  '.venv',
  '__pycache__',
  'target',
  'out',
  '.next',
  '.nuxt',
]);

const MANIFEST_DEP_MAP: Record<string, Record<string, string>> = {
  'package.json': {
    'pg': 'postgres',
    'postgres': 'postgres',
    'mysql': 'mysql',
    'mysql2': 'mysql',
    'redis': 'redis',
    'ioredis': 'redis',
    'mongodb': 'mongodb',
    'mongoose': 'mongodb',
    'amqplib': 'rabbitmq',
    'amqp-connection-manager': 'rabbitmq',
    'kafkajs': 'kafka',
    'elasticsearch': 'elasticsearch',
    '@elastic/elasticsearch': 'elasticsearch',
    'sqlite3': 'sqlite',
    'better-sqlite3': 'sqlite',
    'aws-sdk': 'localstack',
    '@aws-sdk/client-s3': 'localstack',
    'influx': 'influxdb',
    'neo4j-driver': 'neo4j',
  },
  'requirements.txt': {
    'psycopg2': 'postgres',
    'psycopg2-binary': 'postgres',
    'pymysql': 'mysql',
    'mysql-connector-python': 'mysql',
    'redis': 'redis',
    'pymongo': 'mongodb',
    'pika': 'rabbitmq',
    'kafka-python': 'kafka',
    'elasticsearch': 'elasticsearch',
    'boto3': 'localstack',
    'influxdb': 'influxdb',
    'neo4j': 'neo4j',
  },
  'go.mod': {
    'github.com/lib/pq': 'postgres',
    'github.com/jackc/pgx': 'postgres',
    'github.com/go-sql-driver/mysql': 'mysql',
    'github.com/go-redis/redis': 'redis',
    'github.com/redis/go-redis': 'redis',
    'go.mongodb.org/mongo-driver': 'mongodb',
    'github.com/streadway/amqp': 'rabbitmq',
    'github.com/rabbitmq/amqp091-go': 'rabbitmq',
    'github.com/segmentio/kafka-go': 'kafka',
    'github.com/confluentinc/confluent-kafka-go': 'kafka',
    'github.com/aws/aws-sdk-go': 'localstack',
    'github.com/aws/aws-sdk-go-v2': 'localstack',
  }
};

const CODE_DEP_MAP: Record<string, string> = {
  'pg': 'postgres',
  'postgres': 'postgres',
  'mysql': 'mysql',
  'redis': 'redis',
  'ioredis': 'redis',
  'mongodb': 'mongodb',
  'mongoose': 'mongodb',
  'amqplib': 'rabbitmq',
  'pika': 'rabbitmq',
  'boto3': 'localstack',
  'localstack': 'localstack',
  'influxdb': 'influxdb',
  'neo4j': 'neo4j',
  'kafka': 'kafka',
};

// Regex patterns to detect env var usage
const ENV_VAR_REGEXES = [
  /process\.env\.([A-Z0-9_]+)/g,
  /os\.environ\.get\(['"]([A-Z0-9_]+)['"]\)/g,
  /os\.environ\[['"]([A-Z0-9_]+)['"]\]/g,
  /os\.getenv\(['"]([A-Z0-9_]+)['"]\)/g,
  /os\.Getenv\(['"]([A-Z0-9_]+)['"]\)/g,
  /ENV\[['"]([A-Z0-9_]+)['"]\]/g,
  /System\.getenv\(['"]([A-Z0-9_]+)['"]\)/g,
  /dotenv\.config/gi,
];

// Regex patterns to detect API endpoints/routes in code
const ENDPOINT_REGEXES = [
  /(?:app|router|r|route)\.(?:get|post|put|delete|patch|use)\(\s*['"]([^'"]+)['"]/gi,
  /@(?:app|blueprint|route)\.(?:route|get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/gi,
  /(?:r|router)\.(?:GET|POST|PUT|DELETE|PATCH|Use)\(\s*['"]([^'"]+)['"]/g,
];

export function analyzeDirectory(dirPath: string): AnalysisResult {
  const result: AnalysisResult = {
    languages: [],
    manifests: [],
    dependencies: [],
    envVars: [],
    hasEndpoints: false,
    endpoints: [],
  };

  const detectedLanguages = new Set<string>();
  const detectedDependencies = new Set<string>();
  const detectedEnvVars = new Set<string>();
  const detectedEndpoints = new Set<string>();

  function walk(currentDir: string) {
    let files: string[];
    try {
      files = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (!IGNORE_DIRS.has(file)) {
          walk(fullPath);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        
        // 1. Language detection
        if (ext === '.js' || ext === '.jsx') detectedLanguages.add('javascript');
        else if (ext === '.ts' || ext === '.tsx') detectedLanguages.add('typescript');
        else if (ext === '.py') detectedLanguages.add('python');
        else if (ext === '.go') detectedLanguages.add('go');
        else if (ext === '.rb') detectedLanguages.add('ruby');
        else if (ext === '.rs') detectedLanguages.add('rust');
        else if (ext === '.java') detectedLanguages.add('java');

        // 2. Manifest analysis
        if (MANIFEST_DEP_MAP[file]) {
          result.manifests.push(file);
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (file === 'package.json') {
              const pkg = JSON.parse(content);
              const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
              for (const dep of Object.keys(allDeps)) {
                const mapped = MANIFEST_DEP_MAP['package.json'][dep];
                if (mapped) detectedDependencies.add(mapped);
              }
            } else {
              // Requirements.txt or go.mod - simple substring matches
              for (const [key, val] of Object.entries(MANIFEST_DEP_MAP[file])) {
                if (content.includes(key)) {
                  detectedDependencies.add(val);
                }
              }
            }
          } catch {
            // Ignored parsing errors
          }
        }

        // 3. Code contents analysis for imports, env variables, and endpoints
        if (['.js', '.ts', '.py', '.go', '.rb', '.rs', '.java'].includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check imports for DB client matches
            for (const [key, val] of Object.entries(CODE_DEP_MAP)) {
              if (content.includes(key)) {
                detectedDependencies.add(val);
              }
            }

            // Check environment variables
            for (const regex of ENV_VAR_REGEXES) {
              let match;
              regex.lastIndex = 0;
              while ((match = regex.exec(content)) !== null) {
                if (match[1]) {
                  detectedEnvVars.add(match[1]);
                }
              }
            }

            // Check API endpoints
            for (const regex of ENDPOINT_REGEXES) {
              let match;
              regex.lastIndex = 0;
              while ((match = regex.exec(content)) !== null) {
                if (match[1] && match[1].startsWith('/') && !match[1].includes(':') && !match[1].includes('*')) {
                  detectedEndpoints.add(match[1]);
                }
              }
            }
          } catch {
            // Ignore file read errors
          }
        }
      }
    }
  }

  walk(dirPath);

  result.languages = Array.from(detectedLanguages);
  result.dependencies = Array.from(detectedDependencies);
  result.envVars = Array.from(detectedEnvVars);
  result.endpoints = Array.from(detectedEndpoints);
  result.hasEndpoints = result.endpoints.length > 0;

  return result;
}
