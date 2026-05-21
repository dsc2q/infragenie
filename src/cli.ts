#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { analyzeDirectory } from './analyzer';
import { generateInfraFiles } from './generator';
import { generateN8nWorkflow } from './n8n';

// Load .env if present
dotenv.config();

const program = new Command();

program
  .name('infragenie')
  .description('InfraGenie: Analyze codebases and generate local dev infrastructure instantly.')
  .version('0.1.0');

program
  .command('scan')
  .description('Analyze codebase in the target directory and print detected tech stack, env variables, and routes.')
  .option('-d, --dir <directory>', 'Directory to scan', '.')
  .action((options) => {
    const targetDir = path.resolve(options.dir);
    console.log('\n🔍 Scanning codebase at:', targetDir);
    if (!fs.existsSync(targetDir)) {
      console.error(`❌ Error: Target directory "${targetDir}" does not exist.`);
      process.exit(1);
    }
    const analysisResult = analyzeDirectory(targetDir);
    console.log('\n📋 Codebase Scan Summary:');
    console.log(`   • Languages detected: ${analysisResult.languages.join(', ') || 'None'}`);
    console.log(`   • Manifests found: ${analysisResult.manifests.join(', ') || 'None'}`);
    console.log(`   • Infrastructure dependencies detected: ${analysisResult.dependencies.join(', ') || 'None'}`);
    console.log(`   • Env variables referenced: ${analysisResult.envVars.length} found`);
    if (analysisResult.envVars.length > 0) {
      console.log(`     (${analysisResult.envVars.join(', ')})`);
    }
    console.log(`   • API routes detected: ${analysisResult.endpoints.length} found`);
    if (analysisResult.endpoints.length > 0) {
      console.log(`     (${analysisResult.endpoints.join(', ')})`);
    }
    console.log('');
  });

program
  .command('init')
  .alias('up')
  .description('Analyze directory and generate Docker Compose, environment, and startup scripts.')
  .option('-d, --dir <directory>', 'Directory to scan', '.')
  .option('-k, --key <api-key>', 'OpenAI API Key')
  .option('-b, --base-url <url>', 'OpenAI Base URL (defaults to https://api.openai.com/v1)')
  .option('-m, --model <model>', 'OpenAI Model to use', 'gpt-4o')
  .option('-n, --n8n', 'Force generation of n8n testing workflow JSON')
  .action(async (options) => {
    const targetDir = path.resolve(options.dir);

    // Load config file if present
    const configPath = path.join(targetDir, 'infragenie.config.json');
    let fileConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (err: any) {
        console.warn(`⚠️ Warning: Failed to parse configuration file: ${err.message}`);
      }
    }

    const apiKey = options.key || fileConfig.key || process.env.OPENAI_API_KEY;
    const baseUrl = options.baseUrl || fileConfig.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = options.model || fileConfig.model || 'gpt-4o';
    const generateN8n = options.n8n || fileConfig.n8n || false;

    console.log('\n🧞 Welcome to InfraGenie! Let\'s analyze your codebase...');
    console.log(`📂 Scanning directory: ${targetDir}\n`);

    if (!fs.existsSync(targetDir)) {
      console.error(`❌ Error: Target directory "${targetDir}" does not exist.`);
      process.exit(1);
    }

    // 1. Analyze codebase
    let analysisResult;
    try {
      analysisResult = analyzeDirectory(targetDir);
    } catch (err: any) {
      console.error(`❌ Code analysis failed: ${err.message}`);
      process.exit(1);
    }

    console.log('🔍 Codebase Scan Summary:');
    console.log(`   • Languages detected: ${analysisResult.languages.join(', ') || 'None'}`);
    console.log(`   • Manifests found: ${analysisResult.manifests.join(', ') || 'None'}`);
    console.log(`   • Infrastructure dependencies detected: ${analysisResult.dependencies.join(', ') || 'None'}`);
    console.log(`   • Env variables referenced: ${analysisResult.envVars.length} found`);
    console.log(`   • API routes detected: ${analysisResult.endpoints.length} found`);
    console.log('');

    // 2. Load API Key
    if (!apiKey) {
      console.error('❌ Error: OpenAI API Key is missing.');
      console.error('   Please set it via environment variable: export OPENAI_API_KEY="your-key"');
      console.error('   Or pass it directly: infragenie init --key "your-key"');
      process.exit(1);
    }

    // 3. Generate configurations
    console.log('🧠 Generating local development infrastructure configurations via OpenAI...');
    try {
      const generated = await generateInfraFiles(analysisResult, apiKey, baseUrl, model);

      // Write docker-compose.yml
      const composePath = path.join(targetDir, 'docker-compose.yml');
      fs.writeFileSync(composePath, generated['docker-compose.yml'], 'utf8');
      console.log(`   ✅ Generated: docker-compose.yml`);

      // Write .env.example
      const envPath = path.join(targetDir, '.env.example');
      fs.writeFileSync(envPath, generated['.env.example'], 'utf8');
      console.log(`   ✅ Generated: .env.example`);

      // Write init-infra.sh
      const scriptPath = path.join(targetDir, 'init-infra.sh');
      fs.writeFileSync(scriptPath, generated['init-infra.sh'].replace(/\r\n/g, '\n'), 'utf8');
      try {
        fs.chmodSync(scriptPath, 0o755); // make executable
      } catch {}
      console.log(`   ✅ Generated: init-infra.sh`);

      // 4. Generate n8n workflow if applicable
      if (analysisResult.hasEndpoints || generateN8n) {
        const projectName = path.basename(targetDir);
        const n8nWorkflowJson = generateN8nWorkflow(analysisResult.endpoints, projectName);
        const n8nPath = path.join(targetDir, 'infragenie-n8n-tests.json');
        fs.writeFileSync(n8nPath, n8nWorkflowJson, 'utf8');
        console.log(`   ✅ Generated n8n API Test Suite: infragenie-n8n-tests.json`);
      }

      console.log('\n🚀 Success! Infrastructure scripts successfully generated.');
      console.log('   To start your new stack:');
      console.log(`   1. cd ${options.dir}`);
      console.log('   2. Run `./init-infra.sh` or `bash init-infra.sh`');
      if (analysisResult.hasEndpoints || generateN8n) {
        console.log('   3. Import `infragenie-n8n-tests.json` into n8n to test local API routes.');
      }
      console.log('');
    } catch (err: any) {
      console.error(`❌ Infrastructure generation failed: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
