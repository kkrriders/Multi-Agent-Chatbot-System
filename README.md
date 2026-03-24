# Multi-Agent Chatbot System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-154%20passing-brightgreen)](#testing)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](https://docs.docker.com/compose/)

A multi-agent AI system that routes user messages to specialized local LLMs — Llama3, Mistral, Phi3, and Qwen — running entirely on your hardware via Ollama. Includes JWT authentication, circuit breakers, Prometheus metrics, semantic memory, prompt versioning, LLM tracing, and a full Docker Compose deployment.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Extending the System](#extending-the-system)
- [Security](#security)
- [License](#license)

---

## Features

| Category | Highlights |
|----------|------------|
| **Security** | JWT auth, HMAC-signed agent calls, Redis-backed rate limiting, append-only audit log |
| **Resilience** | Per-agent circuit breakers, exponential backoff with full jitter, graceful shutdown |
| **Routing** | Content-aware model selection (code → Qwen, analytical → Mistral, creative → Phi3, general → Llama3) |
| **Observability** | Prometheus metrics, JSONL LLM traces, optional OpenTelemetry + Jaeger |
| **AI Features** | Semantic memory with vector embeddings, conversation summarization, token usage tracking, prompt versioning |
| **Evaluation** | LLM-as-judge eval harness with `pass@k` metrics |
| **Deployment** | Full Docker Compose stack — MongoDB, Redis, manager, 4 agents, Next.js frontend, optional Jaeger |
| **Tests** | 154 tests: 32 unit + 122 e2e, all passing |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Next.js Frontend  :3002                         │
│         React 19 · TypeScript · Tailwind · Socket.IO        │
└──────────────────────────┬───────────────────────────────────┘
                           │ JWT · WebSocket
┌──────────────────────────▼───────────────────────────────────┐
│                    Manager Agent  :3000                      │
│   Auth · Routing · Circuit Breakers · Prometheus /metrics   │
│   Rate Limiting · HMAC Signing · Conversation Cache         │
└──────┬───────────┬───────────┬───────────┬───────────────────┘
       │           │           │           │  HMAC-signed HTTP
  ┌────▼───┐  ┌───▼────┐  ┌───▼────┐  ┌───▼────┐
  │ Llama3 │  │Mistral │  │  Phi3  │  │  Qwen  │
  │ :3005  │  │ :3006  │  │ :3007  │  │ :3008  │
  │general │  │analyt. │  │creativ.│  │  code  │
  └────────┘  └────────┘  └────────┘  └────────┘
       │           │           │           │
┌──────▼───────────────────────────────────▼───────────────────┐
│                    Ollama  :11434                            │
│        llama3 · mistral · phi3 · qwen2.5-coder              │
└──────────────────────────────────────────────────────────────┘
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  MongoDB  :27017 │  │ Redis  :6379 │  │ Jaeger  :16686       │
│  Conversations   │  │ Rate limits  │  │ Distributed tracing  │
│  Users · Memory  │  │ Session cache│  │ (optional profile)   │
└──────────────────┘  └──────────────┘  └──────────────────────┘
```

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/your-username/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system
cp .env.example .env       # set JWT_SECRET and AGENT_SHARED_SECRET
docker compose up -d
```

To include distributed tracing:
```bash
docker compose --profile tracing up -d
```

| URL | Service |
|-----|---------|
| http://localhost:3002 | Next.js frontend |
| http://localhost:3000 | Manager API (REST + WebSocket) |
| http://localhost:3000/metrics | Prometheus metrics |
| http://localhost:3000/api/health | Health check (JSON) |
| http://localhost:16686 | Jaeger UI (tracing profile only) |

### Option B — Local Development

**Prerequisites:** Node.js 18+, MongoDB, Redis, Ollama

```bash
# 1. Pull models
ollama pull llama3:latest
ollama pull mistral:latest
ollama pull phi3:latest
ollama pull qwen2.5-coder:latest

# 2. Install dependencies
npm install
cd multi-agent-chatbot && npm install && cd ..

# 3. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, AGENT_SHARED_SECRET, MONGODB_URI, REDIS_URL

# 4. Start all services
npm start                    # backend only (start-stable.js)
npm run dev                  # backend services with colored output
npm run start-with-frontend  # backend + Next.js frontend
```

---

## Environment Variables

Copy `.env.example` for the full annotated list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Min 32 chars — signs user JWTs |
| `AGENT_SHARED_SECRET` | Yes | Min 32 chars — HMAC signs manager→agent calls |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `OLLAMA_API_BASE` | Yes | Ollama base URL (default: `http://localhost:11434/api`) |
| `MANAGER_PORT` | No | Default: `3000` |
| `AGENT_1_PORT` — `AGENT_4_PORT` | No | Defaults: `3005`–`3008` |
| `AGENT_1_MODEL` — `AGENT_4_MODEL` | No | Model names (e.g. `llama3:latest`) |
| `AGENT_1_URL` — `AGENT_4_URL` | Docker | Set automatically by `docker-compose.yml` |
| `OTEL_ENABLED` | No | `true` to emit OpenTelemetry spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OTLP receiver URL |
| `OLLAMA_TIMEOUT` / `AGENT_TIMEOUT` | No | Request timeouts in ms (default: `180000`) |

> **Startup aborts** if `JWT_SECRET` or `AGENT_SHARED_SECRET` are missing or shorter than 32 characters.

---

## API Reference

### Authentication

```http
POST /auth/register
POST /auth/login
```

Both return `{ token }`. Pass it on all subsequent requests as `Authorization: Bearer <token>`.

### Messaging

```http
POST /message
Content-Type: application/json

{ "content": "explain async/await", "conversationId": "<id>" }
```

```http
POST /team-conversation
Content-Type: application/json

{ "message": "compare REST vs GraphQL", "agents": ["agent-1", "agent-2"] }
```

Override automatic routing via `X-Agent` header or `"agent"` field in the request body.

### Conversations

```http
GET    /api/conversations           # list user conversations
GET    /api/conversations/:id       # full history
DELETE /api/conversations/:id       # delete
GET    /api/conversations/:id/usage # token usage by model
```

### Prompt Versioning

```http
GET    /api/prompts                 # list all versions
POST   /api/prompts                 # create new version
POST   /api/prompts/:id/activate    # set active prompt
DELETE /api/prompts/:id
```

### Monitoring

```http
GET /api/health   # MongoDB, Redis, agents, circuit breaker states
GET /metrics      # Prometheus metrics
GET /status       # legacy status endpoint
```

### WebSocket (Socket.IO)

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('join-conversation', conversationId);
socket.on('token', (chunk) => process.stdout.write(chunk));  // streaming
socket.on('conversation-update', (msg) => console.log(msg));
```

---

## Key Features

### Content-Aware Model Routing

Messages are automatically dispatched to the best-fit model:

| Keywords | Model | Agent |
|----------|-------|-------|
| `code`, `debug`, `function`, `api`, `implement` | `qwen2.5-coder` | agent-qwen |
| `analyze`, `research`, `compare`, `data`, `statistics` | `mistral` | agent-mistral |
| `story`, `poem`, `creative`, `brainstorm`, `fiction` | `phi3` | agent-phi3 |
| *(everything else)* | `llama3` | agent-llama3 |

### Circuit Breakers

Each agent has an independent circuit breaker: **CLOSED → OPEN** after 3 consecutive failures → **HALF_OPEN** after 30 s. The manager falls back gracefully and exposes circuit states in `/api/health`.

### LLM Tracing

Every LLM call is appended to `logs/llm-traces.jsonl`:

```json
{
  "timestamp": "2026-03-20T10:00:00.000Z",
  "model": "qwen2.5-coder",
  "inputTokens": 142,
  "outputTokens": 87,
  "durationMs": 1240,
  "agentId": "agent-qwen"
}
```

### Semantic Memory

Each agent stores user-specific memories with vector embeddings via Ollama `/api/embeddings`. Retrieval uses cosine similarity when embeddings are available, Jaccard similarity as fallback.

### Token Usage Tracking

```http
GET /api/conversations/:id/usage
→ { "qwen2.5-coder": { "inputTokens": 450, "outputTokens": 210 }, ... }
```

### Eval Harness

LLM-as-judge evaluation against `tests/evals/dataset.jsonl`:

```bash
npm run eval
# writes pass/fail report to logs/eval-report.jsonl
```

### OpenTelemetry

Set `OTEL_ENABLED=true` to emit spans to any OTLP-compatible backend (Jaeger, Tempo, Honeycomb). Start Jaeger locally with `docker compose --profile tracing up -d`.

---

## Project Structure

```
├── src/
│   ├── agents/
│   │   ├── manager/         # Central orchestrator: routing, auth, metrics
│   │   ├── agent-llama3/    # General-purpose agent
│   │   ├── agent-mistral/   # Analytical agent
│   │   ├── agent-phi3/      # Creative agent
│   │   └── agent-qwen/      # Code agent
│   ├── shared/
│   │   ├── agent-base.js    # Base class: memory, streaming, HMAC verify
│   │   ├── agent-config.js  # Prompt versioning cache
│   │   ├── agentAuth.js     # HMAC-SHA256 sign/verify
│   │   ├── circuitBreaker.js
│   │   ├── llmTracer.js     # JSONL trace writer
│   │   ├── memory.js        # Semantic memory + embeddings
│   │   ├── modelRouter.js   # Content-aware model selection
│   │   ├── ollama.js        # Ollama client + retry
│   │   ├── retry.js         # Full-jitter exponential backoff
│   │   ├── summarizer.js    # Conversation summarization
│   │   └── tracing.js       # OpenTelemetry init
│   ├── middleware/
│   │   ├── auditLog.js      # Append-only audit.log
│   │   └── rateLimiter.js   # Redis-backed rate limits
│   ├── models/
│   │   ├── Conversation.js  # Message + tokenUsage schema
│   │   ├── Memory.js        # Memory + embedding schema
│   │   ├── PromptVersion.js # Versioned system prompts
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── conversations.js
│   │   └── prompts.js
│   ├── monitoring/
│   │   └── metrics.js       # Prometheus (7 custom metrics + Node defaults)
│   ├── config/
│   │   ├── database.js
│   │   └── redis.js
│   ├── scripts/
│   │   └── evalHarness.js   # LLM-as-judge eval runner
│   └── utils/
│       ├── jwt.js
│       └── validateEnv.js   # Startup validation for required secrets
├── multi-agent-chatbot/     # Next.js 15 frontend
│   └── app/chat/            # Chat UI with Socket.IO streaming
├── tests/
│   ├── unit/                # 32 Jest unit tests
│   ├── e2e/                 # 122 Jest e2e tests (supertest)
│   └── evals/
│       └── dataset.jsonl    # 10 eval pairs for LLM-as-judge
├── logs/
│   ├── audit.log
│   ├── llm-traces.jsonl
│   └── eval-report.jsonl
├── docker-compose.yml       # Full stack (MongoDB, Redis, agents, frontend, Jaeger)
├── Dockerfile               # Backend image
├── multi-agent-chatbot/Dockerfile  # Frontend 3-stage build
└── .env.example
```

---

## Testing

```bash
npm test             # all 154 tests
npm run test:unit    # 32 unit tests
npm run test:e2e     # 122 e2e tests (auth, conversations, health, prompts)
npm run eval         # eval harness → logs/eval-report.jsonl
```

---

## Extending the System

### Adding a New Agent

1. Copy `src/agents/agent-llama3/` → `src/agents/agent-{name}/`
2. Set `this.model` and `this.agentName` in the constructor
3. Add port to `.env` and a service entry to `docker-compose.yml`
4. Register the agent in `src/agents/manager/index.js`
5. Add routing keywords to `src/shared/modelRouter.js` if needed

---

## Security

- `JWT_SECRET` and `AGENT_SHARED_SECRET` must be at least 32 characters — startup aborts if not
- All manager → agent HTTP calls are HMAC-SHA256 signed and verified on receipt
- Rate limits: 5 req/15 min (auth endpoints), 30 req/min (messages), 10 req/hour (exports)
- All authentication events are written to `logs/audit.log`
- `.env` is gitignored — never commit secrets

---

## License

[MIT](LICENSE)

## Acknowledgments

- [Ollama](https://ollama.ai) — local LLM inference
- [Meta AI](https://ai.meta.com) — Llama models
- [Mistral AI](https://mistral.ai) — Mistral models
- [Microsoft](https://microsoft.com) — Phi-3 models
- [Alibaba / Qwen Team](https://qwenlm.github.io) — Qwen models
