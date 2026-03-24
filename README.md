# Multi-Agent Chatbot System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-34%20unit%20passing-brightgreen)](#testing)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](https://docs.docker.com/compose/)

A multi-agent AI system that routes user messages to specialized LLMs via **Groq** — no GPU, no model downloads, no local inference required. Get a free API key, set one env var, and start chatting.

Agents specialise by task type (code, analysis, creative, general) and communicate over HMAC-signed HTTP. The stack includes JWT authentication, circuit breakers, Prometheus metrics, semantic memory, prompt versioning, LLM tracing, and a full Docker Compose deployment.

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
| **LLM Backend** | Groq free-tier cloud inference — no GPU or local model downloads needed |
| **Security** | JWT auth, HMAC-signed agent calls, Redis-backed rate limiting, append-only audit log |
| **Resilience** | Per-agent circuit breakers, exponential backoff with full jitter, graceful shutdown |
| **Routing** | Content-aware model selection (code → Llama3-70b, analysis → Mixtral, creative → Gemma2, general → Llama3-8b) |
| **Observability** | Prometheus metrics, JSONL LLM traces, optional OpenTelemetry + Jaeger |
| **AI Features** | Semantic memory with cosine/Jaccard similarity, conversation summarisation, token usage tracking, prompt versioning |
| **Evaluation** | LLM-as-judge eval harness + routing validation tests |
| **Deployment** | Full Docker Compose stack — MongoDB, Redis, manager, 4 agents, Next.js frontend, optional Jaeger |

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
  │ agent-1│  │ agent-2│  │ agent-3│  │ agent-4│
  │ :3005  │  │ :3006  │  │ :3007  │  │ :3008  │
  │general │  │analyt. │  │creativ.│  │  code  │
  └────────┘  └────────┘  └────────┘  └────────┘
       │           │           │           │
┌──────▼───────────────────────────────────▼───────────────────┐
│                    Groq Cloud API                            │
│   llama3-8b · mixtral-8x7b · gemma2-9b · llama3-70b        │
│   Each model has its own independent rate limit bucket      │
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
cp .env.example .env
# Edit .env — set JWT_SECRET, AGENT_SHARED_SECRET, GROQ_API_KEY
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

**Prerequisites:** Node.js 18+, MongoDB, Redis, a free [Groq API key](https://console.groq.com)

```bash
# 1. Install dependencies
npm install
cd multi-agent-chatbot && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, AGENT_SHARED_SECRET, MONGODB_URI, GROQ_API_KEY

# 3. Start all services
npm run dev                  # backend services with coloured output
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
| `GROQ_API_KEY` | Yes | Groq API key — starts with `gsk_` (free at console.groq.com) |
| `REDIS_URL` | No | Redis URL — falls back to in-memory rate limiting if unset |
| `FRONTEND_URL` | Yes | Allowed CORS origin (default: `http://localhost:3002`) |
| `MANAGER_PORT` | No | Default: `3000` |
| `AGENT_1_PORT` — `AGENT_4_PORT` | No | Defaults: `3005`–`3008` |
| `AGENT_1_MODEL` — `AGENT_4_MODEL` | No | Groq model IDs (see defaults in `.env.example`) |
| `AGENT_1_URL` — `AGENT_4_URL` | Docker | Set automatically by `docker-compose.yml` |
| `OTEL_ENABLED` | No | `true` to emit OpenTelemetry spans |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OTLP receiver URL |

> **Startup aborts** if `JWT_SECRET`, `AGENT_SHARED_SECRET`, or `GROQ_API_KEY` are missing or invalid.

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

Messages are automatically dispatched to the best-fit Groq model. Each model has its own independent rate-limit bucket, so routing effectively multiplies total throughput.

| Keywords | Model | Agent | Specialisation |
|----------|-------|-------|----------------|
| `code`, `debug`, `function`, `sql`, `implement`, `algorithm` | `llama3-70b-8192` | agent-4 | Code generation |
| `analyze`, `research`, `compare`, `data`, `statistics` | `mixtral-8x7b-32768` | agent-2 | Analysis (32k context) |
| `story`, `poem`, `creative`, `brainstorm`, `fiction` | `gemma2-9b-it` | agent-3 | Creative writing |
| *(everything else)* | `llama3-8b-8192` | agent-1 | General purpose |

All model defaults are overridable via `AGENT_{N}_MODEL` env vars — no code changes required.

### Circuit Breakers

Each agent has an independent circuit breaker: **CLOSED → OPEN** after 3 consecutive failures → **HALF_OPEN** after 30 s. The manager falls back gracefully and exposes circuit states in `/api/health`.

### LLM Tracing

Every LLM call is appended to `logs/llm-traces.jsonl`:

```json
{
  "timestamp": "2026-03-24T10:00:00.000Z",
  "model": "llama3-70b-8192",
  "inputTokens": 142,
  "outputTokens": 87,
  "durationMs": 1240,
  "agentId": "agent-4"
}
```

### Semantic Memory

Each agent stores user-specific memories. Retrieval uses cosine similarity when embeddings are available (requires an external embeddings API), with Jaccard similarity as automatic fallback.

### Token Usage Tracking

```http
GET /api/conversations/:id/usage
→ { "llama3-70b-8192": { "inputTokens": 450, "outputTokens": 210 }, ... }
```

### Eval Harness

Automated evaluations against `tests/evals/dataset.jsonl` (18 pairs across three categories):

- **routing** — verifies the model router selects the correct Groq model for a given query (no LLM call, runs instantly)
- **quality** — LLM-as-judge scores agent answers 0–10 against expected answers

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
│   │   ├── agent-llama3/    # General-purpose agent (llama3-8b)
│   │   ├── agent-mistral/   # Analytical agent (mixtral-8x7b)
│   │   ├── agent-phi3/      # Creative agent (gemma2-9b)
│   │   └── agent-qwen/      # Code agent (llama3-70b)
│   ├── shared/
│   │   ├── agent-base.js    # Base class: memory, streaming, HMAC verify
│   │   ├── agent-config.js  # Prompt versioning cache
│   │   ├── agentAuth.js     # HMAC-SHA256 sign/verify
│   │   ├── circuitBreaker.js
│   │   ├── llmTracer.js     # JSONL trace writer
│   │   ├── memory.js        # Semantic memory + cosine/Jaccard similarity
│   │   ├── modelRouter.js   # Content-aware Groq model selection
│   │   ├── ollama.js        # Groq API client (same interface as previous Ollama client)
│   │   ├── retry.js         # Full-jitter exponential backoff
│   │   ├── summarizer.js    # Conversation summarisation
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
│   │   └── evalHarness.js   # LLM-as-judge + routing eval runner
│   └── utils/
│       ├── jwt.js
│       └── validateEnv.js   # Startup validation (JWT_SECRET, GROQ_API_KEY, etc.)
├── multi-agent-chatbot/     # Next.js 15 frontend
│   └── app/chat/            # Chat UI with Socket.IO streaming
├── tests/
│   ├── unit/                # 34 Jest unit tests
│   ├── e2e/                 # Jest e2e tests (supertest)
│   └── evals/
│       └── dataset.jsonl    # 18 eval pairs (8 routing + 10 quality)
├── logs/
│   ├── audit.log
│   ├── llm-traces.jsonl
│   └── eval-report.jsonl
├── DECISIONS.md             # Architectural decisions and tradeoffs
├── docker-compose.yml       # Full stack (MongoDB, Redis, agents, frontend, Jaeger)
├── Dockerfile               # Backend image
├── multi-agent-chatbot/Dockerfile  # Frontend 3-stage build
└── .env.example
```

---

## Testing

```bash
npm run test:unit    # 34 unit tests (Jest)
npm run test:e2e     # e2e tests — auth, conversations, health, prompts
npm run eval         # eval harness → logs/eval-report.jsonl
```

---

## Extending the System

### Adding a New Agent

1. Copy `src/agents/agent-llama3/` → `src/agents/agent-{name}/`
2. Set `this.model` (a Groq model ID) and `this.agentName` in the constructor
3. Add port to `.env` and a service entry to `docker-compose.yml`
4. Register the agent in `src/agents/manager/index.js`
5. Add routing keywords to `src/shared/modelRouter.js` if needed

### Swapping Models

Change `AGENT_{N}_MODEL` in `.env` to any model available on your Groq plan. No code changes needed. See available models at [console.groq.com/docs/models](https://console.groq.com/docs/models).

---

## Security

- `JWT_SECRET`, `AGENT_SHARED_SECRET`, and `GROQ_API_KEY` are validated at startup — the process aborts if any are missing or malformed
- All manager → agent HTTP calls are HMAC-SHA256 signed and verified on receipt
- Rate limits: 5 req/15 min (auth endpoints), 30 req/min (messages), 10 req/hour (exports)
- All authentication events are written to `logs/audit.log`
- `.env` is gitignored — never commit secrets

---

## License

[MIT](LICENSE)

## Acknowledgments

- [Groq](https://groq.com) — fast free-tier cloud inference
- [Meta AI](https://ai.meta.com) — Llama models
- [Mistral AI](https://mistral.ai) — Mixtral models
- [Google DeepMind](https://deepmind.google) — Gemma models
