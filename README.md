# 🧞 InfraGenie

### Auto-generate production-ready local infrastructure stacks directly from your codebase in seconds.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge&logo=opensourceinitiative&logoColor=white&color=007ACC)](LICENSE)
[![NPM Version](https://img.shields.io/npm/v/infragenie.svg?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/infragenie)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg?style=for-the-badge&logo=node.js&logoColor=white&color=43853D)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge&logo=github)](https://github.com/dsc2q/infragenie/pulls)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/dsc2q/infragenie/actions)

---

## ⚡ Developer Experience: Manual vs. Automated

Why waste 15 minutes of dev time writing boilerplate configs when AI can analyze your imports and spin it up instantly?

### The Old manual Way 🔴
```text
┌────────────────────────────────────────────────────────┐
│                   THE OLD MANUAL WAY                   │
└────────────────────────────────────────────────────────┘
  [Codebase]
      │
      ├───► [Manifests] ──► Hunt dependencies & match correct Docker images...
      │
      ├───► [Docker] ─────► Code docker-compose.yml by hand (ports, networks, volumes)
      │
      └───► [Config] ─────► Sync database passwords & port URLs inside .env...
                                                                 
                                                                 🔴 15+ mins of friction!
                                                                 ❌ No container healthchecks
                                                                 ❌ Inconsistent port bindings
```

### The InfraGenie Way 🟢
```text
┌────────────────────────────────────────────────────────┐
│                   THE INFRAGENIE WAY                   │
└────────────────────────────────────────────────────────┘
  infragenie init (or infragenie up)
      │
      ├───► Scans package files & source code imports automatically
      │
      ├───► Resolves dependency environment variables & API endpoints
      │
      └───► Spits out fully configured compose files + .env + bootstrap shell scripts
                                                                 
                                                                 🟢 Done in 3 seconds!
                                                                 ⚡ Zero manual configs
                                                                 🚀 Stack ready to spin up!
```

---

## 🔥 Core Features

* 🔍 **Deep Code Scanning**: Instantly scans your project directory (supporting Node.js, Python, Go, Rust, Ruby, and Java) to map out package dependencies, imports (like `pg` or `ioredis`), environment variables, and routing controllers.
* 🐳 **Smart Docker-Compose Generation**: Generates high-quality, containerized services (Postgres, Redis, RabbitMQ, MongoDB, Kafka, etc.) configured with robust **healthchecks** (using `pg_isready` or `redis-cli ping`), persistent host volumes, and isolated networks.
* 🔑 **Instant .env Bootstrap**: Creates a corresponding `.env.example` pre-configured to link the local database, cache, or broker urls straight to the mapped container ports.
* 🎛️ **Local Automation Bridge**: Parses Express/Flask/Fastify API routes and creates a ready-to-import n8n integration workflow file to run automated backend testing suites locally.

---

## 🚀 Installation & Quick Start

Get up and running globally in a single command:

```bash
# Install globally via npm
npm install -g infragenie

# Or execute on-the-fly using npx
npx infragenie init
```

*Note: On Windows systems with restricted PowerShell execution policies, prepend commands with `cmd /c` (e.g., `cmd /c infragenie init`).*

### Set Up API Authentication

Set your OpenAI API Key as an environment variable:

```bash
# macOS / Linux
export OPENAI_API_KEY="sk-proj-..."

# Windows (Command Prompt)
set OPENAI_API_KEY="sk-proj-..."

# Windows (PowerShell)
$env:OPENAI_API_KEY="sk-proj-..."
```

---

## ⚙️ How to Use

Navigate to any repository directory containing manifest files and run:

### 1. Scan and Analyze Codebase
To see what languages, dependency files, environment variables, and REST endpoints InfraGenie discovers in your project without calling any LLM APIs:
```bash
infragenie scan
```

### 2. Generate Development Stack
To call the OpenAI completions API and generate your docker-compose, environment, and startup files:
```bash
infragenie init
# (Or use the command alias)
infragenie up
```

### 🔧 Command CLI Options

Customize execution settings using command-line arguments:

| Option | Flag | Description | Default |
|---|---|---|---|
| **Directory** | `-d, --dir <path>` | Directory to scan for code | `.` (current folder) |
| **API Key** | `-k, --key <token>` | OpenAI API Key override | `process.env.OPENAI_API_KEY` |
| **Base URL** | `-b, --base-url <url>` | Custom endpoint for OpenAI-compatible APIs | `https://api.openai.com/v1` |
| **Model** | `-m, --model <name>` | Model override | `gpt-4o` |
| **n8n Workflow** | `-n, --n8n` | Force write out of n8n webhook test JSON | `false` |

---

## 🔧 Team Configuration (`infragenie.config.json`)

Ensure everyone on your engineering team uses the same local infrastructure conventions. Drop an `infragenie.config.json` in the root of your project:

```json
{
  "model": "gpt-4o",
  "baseUrl": "https://api.openai.com/v1",
  "n8n": true
}
```

Whenever anyone runs `infragenie init` in that repository, the tool will automatically apply these settings.

---

## 📐 Architecture & Flow

```mermaid
graph TD
    subgraph Analysis Phase
        DIR[Target Project Code] -->|infragenie scan| SCAN[Static Analyzer Engine]
        SCAN -->|Manifests & Imports| DEPS[Mapped DB/Cache/Queue Deps]
        SCAN -->|Env Signatures & Routes| API[MAPPED Env Variables & Endpoints]
    end
    subgraph Intelligence Phase
        DEPS & API -->|Structured Payload| LLM[OpenAI / Compatible Endpoint]
        LLM -->|Infrastructure Markdown| CLI[CLI Output Engine]
    end
    subgraph Outputs & Launch
        CLI -->|Write| COM[docker-compose.yml]
        CLI -->|Write| ENV[.env.example]
        CLI -->|Write & Chmod| SH[init-infra.sh]
        CLI -->|Write| N8N[infragenie-n8n-tests.json]
    end
    style Analysis Phase fill:#fdfefe,stroke:#007ACC,stroke-width:1px
    style Intelligence Phase fill:#f4f6f7,stroke:#2C3E50,stroke-width:1px
    style Outputs & Launch fill:#f4fbf7,stroke:#27AE60,stroke-width:1px
```

---

## 🤝 Contributing

We love local-first developer tools and infrastructure hacks!
1. Fork the repo and clone it.
2. Build typescript files: `npm run build`
3. Link binary locally: `npm link`
4. Make your improvements (e.g., adding more language parsers or dependency rule maps) and submit a pull request!

---

## ⭐ Show Your Support

If **InfraGenie** saved you from writing boilerplate or debugging ports, drop a ⭐ on this repository! Your support keeps us adding awesome features.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
