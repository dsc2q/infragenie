import { AnalysisResult } from './analyzer';

export interface GenerationResult {
  'docker-compose.yml': string;
  '.env.example': string;
  'init-infra.sh': string;
}

export async function generateInfraFiles(
  analysis: AnalysisResult,
  apiKey: string,
  baseUrl = 'https://api.openai.com/v1',
  model = 'gpt-4o'
): Promise<GenerationResult> {
  const systemPrompt = `You are an expert infrastructure architect and DevOps engineer.
Your task is to generate local development infrastructure configuration files based on a code analysis report of a local project.

You must generate exactly three files. Print them inside markdown code blocks, prefixed by a level 3 heading specifying the file name.

Format example:
### docker-compose.yml
\`\`\`yaml
version: '3.8'
services:
  ...
\`\`\`

### .env.example
\`\`\`env
PORT=3000
...
\`\`\`

### init-infra.sh
\`\`\`bash
#!/bin/bash
...
\`\`\`

Requirements for the generated files:
1. 'docker-compose.yml':
   - Include services for detected dependencies (e.g. postgres, redis, rabbitmq, mongodb, kafka, localstack). If none are detected, default to standard Postgres & Redis as a reasonable default stack.
   - Configure local data volumes (e.g., ./data/postgres:/var/lib/postgresql/data) to persist data.
   - Configure container healthchecks (e.g., pg_isready for Postgres, redis-cli ping for Redis).
   - Standard ports mapped to localhost.
   - Make sure services are on a custom docker network (e.g., 'infragenie-net').
   - Keep credentials simple, safe, and standard (e.g., user 'postgres', password 'postgres').

2. '.env.example':
   - Define environment variables detected in the codebase (e.g., DATABASE_URL, REDIS_URL, etc.) with values matching the Docker Compose services.
   - Keep it clean, well-commented, and safe.

3. 'init-infra.sh':
   - A shell script to automate volume folder creation, check for Docker presence, copy .env.example to .env (if not present), and execute 'docker compose up -d'.
   - Add loops to check container healthchecks before exiting.
   - Make it cross-platform compatible or standard bash. Use Unix LF line endings.
`;

  const userPrompt = `Code Analysis Report:
- Detected Languages: ${JSON.stringify(analysis.languages)}
- Found Manifests: ${JSON.stringify(analysis.manifests)}
- Matched Dependencies: ${JSON.stringify(analysis.dependencies)}
- Detected Environment Variables: ${JSON.stringify(analysis.envVars)}

Please generate 'docker-compose.yml', '.env.example', and 'init-infra.sh' matching these requirements.`;

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI API.');
  }

  const parsed = parseMarkdownFiles(content);

  if (!parsed['docker-compose.yml'] || !parsed['.env.example'] || !parsed['init-infra.sh']) {
    // Try a relaxed parser if names don't match exactly
    const keys = Object.keys(parsed);
    const composeKey = keys.find(k => k.toLowerCase().includes('compose'));
    const envKey = keys.find(k => k.toLowerCase().includes('env'));
    const scriptKey = keys.find(k => k.toLowerCase().includes('init') || k.endsWith('.sh'));

    const finalResult: GenerationResult = {
      'docker-compose.yml': parsed['docker-compose.yml'] || (composeKey ? parsed[composeKey] : ''),
      '.env.example': parsed['.env.example'] || (envKey ? parsed[envKey] : ''),
      'init-infra.sh': parsed['init-infra.sh'] || (scriptKey ? parsed[scriptKey] : ''),
    };

    if (!finalResult['docker-compose.yml'] || !finalResult['.env.example'] || !finalResult['init-infra.sh']) {
      throw new Error(`Could not parse all files from OpenAI response. Keys parsed: ${JSON.stringify(keys)}\nRaw output was:\n${content}`);
    }

    return finalResult;
  }

  return parsed as unknown as GenerationResult;
}

function parseMarkdownFiles(markdown: string): Record<string, string> {
  const files: Record<string, string> = {};
  // Match both level 3 headers (### file) and bold files (**file**)
  const regex = /(?:###|\*\*)\s*([a-zA-Z0-9_\-\.]+)\s*(?:\*\*)?\s*[\r\n]+```(?:yaml|yml|env|bash|sh)?[\r\n]+([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    if (match[1] && match[2]) {
      files[match[1].trim()] = match[2].trim();
    }
  }
  return files;
}
