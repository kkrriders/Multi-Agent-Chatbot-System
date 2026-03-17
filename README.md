# Multi-Agent Chatbot System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-154%20passing-brightgreen)](#testing)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](https://docs.docker.com/compose/)

A production-ready multi-agent AI system that routes user messages to specialized local LLMs (Llama3, Mistral, Phi3, Qwen), with JWT authentication, circuit breakers, Prometheus metrics, semantic memory, prompt versioning, LLM tracing, and full Docker Compose deployment.

## What's in This Version

- **Security-first**: JWT auth, HMAC-signed agent calls, Redis-backed rate limiting, audit logs
- **Resilience**: Circuit breakers per agent, exponential backoff retry, graceful shutdown
- **Intelligent routing**: Content-aware model selection (code → Qwen, creative → Phi3, analytical → Mistral, general → Llama3)
- **Observability**: Prometheus metrics, LLM tracing to JSONL, OpenTelemetry + Jaeger support
- **AI features**: Semantic memory with embeddings, conversation summarization, token usage tracking, prompt versioning
- **Eval harness**: LLM-as-judge evaluation with `pass@k` metrics
- **Docker**: Full stack via `docker-compose.yml` (MongoDB, Redis, manager, 4 agents, frontend, optional Jaeger)
- **154 tests**: 32 unit + 122 e2e, all passing

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Next.js Frontend  :3002                         │
│         React 19 · TypeScript · Tailwind · Socket.IO        │
└──────────────────────────┬───────────────────────────────────┘
                           │ JWT  WebSocket
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

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/your-username/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system
cp .env.example .env          # fill in JWT_SECRET and AGENT_SHARED_SECRET
docker compose up -d
```

With distributed tracing:
```bash
docker compose --profile tracing up -d
```

Services:
| URL | Service |
|-----|---------|
| http://localhost:3002 | Next.js frontend |
| http://localhost:3000 | Manager REST + WebSocket API |
| http://localhost:3000/metrics | Prometheus metrics |
| http://localhost:3000/api/health | Health check (JSON) |
| http://localhost:16686 | Jaeger UI (tracing profile) |

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
node start-stable.js                 # backend only
npm run start-with-frontend          # backend + Next.js frontend
```

## Environment Variables

```bash
# --- Required secrets (generate strong random values) ---
JWT_SECRET=your-secret-here-min-32-chars
AGENT_SHARED_SECRET=your-hmac-secret-here-min-32-chars

# --- Ports ---
MANAGER_PORT=3000
AGENT_1_PORT=3005
AGENT_2_PORT=3006
AGENT_3_PORT=3007
AGENT_4_PORT=3008
FRONTEND_PORT=3002

# --- Models ---
AGENT_1_MODEL=llama3:latest
AGENT_2_MODEL=mistral:latest
AGENT_3_MODEL=phi3:latest
AGENT_4_MODEL=qwen2.5-coder:latest

# --- Services ---
OLLAMA_API_BASE=http://localhost:11434/api
MONGODB_URI=mongodb://localhost:27017/chatbot
REDIS_URL=redis://localhost:6379

# --- Docker agent routing (set automatically by docker-compose) ---
AGENT_1_URL=http://agent-llama3:3005
AGENT_2_URL=http://agent-mistral:3006
AGENT_3_URL=http://agent-phi3:3007
AGENT_4_URL=http://agent-qwen:3008

# --- OpenTelemetry (optional) ---
OTEL_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# --- Timeouts ---
OLLAMA_TIMEOUT=180000
AGENT_TIMEOUT=180000
```

Copy `.env.example` for the full list with descriptions.

## API Reference

### Authentication

```http
POST /auth/register
POST /auth/login
# Returns: { token }
```

All subsequent requests require `Authorization: Bearer <token>`.

### Messages

```http
POST /message
{ "content": "explain async/await", "conversationId": "..." }

POST /team-conversation
{ "message": "compare REST vs GraphQL", "agents": ["agent-1", "agent-2"] }
```

### Conversations

```http
GET  /api/conversations              # list user conversations
GET  /api/conversations/:id          # get with full history
DELETE /api/conversations/:id        # delete

GET  /api/conversations/:id/usage    # token usage breakdown by model
```

### Prompt Versioning

```http
GET    /api/prompts                  # list all versions
POST   /api/prompts                  # create new version
POST   /api/prompts/:id/activate     # set active prompt
DELETE /api/prompts/:id
```

### Monitoring

```http
GET /api/health        # system health (MongoDB, Redis, agents, circuit breakers)
GET /metrics           # Prometheus metrics
GET /status            # legacy status
```

### WebSocket (Socket.IO)

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.emit('join-conversation', conversationId);
socket.on('token', (chunk) => process.stdout.write(chunk));   // streaming
socket.on('conversation-update', (msg) => console.log(msg));
```

## Key Features

### Model Routing

Messages are automatically routed to the best model based on content:

| Keywords | Model | Agent |
|----------|-------|-------|
| code, debug, function, api, implement | `qwen2.5-coder` | agent-qwen |
| analyze, research, compare, data, statistics | `mistral` | agent-mistral |
| story, poem, creative, brainstorm, fiction | `phi3` | agent-phi3 |
| *(everything else)* | `llama3` | agent-llama3 |

Override via `X-Agent` header or `agent` field in the request body.

### Circuit Breakers

Each agent has an independent circuit breaker (CLOSED → OPEN after 3 failures → HALF_OPEN after 30 s). The manager falls back gracefully when an agent is unavailable. Circuit breaker state is exposed in `/api/health`.

### LLM Tracing

Every LLM call is traced to `logs/llm-traces.jsonl`:
```json
{ "timestamp": "...", "model": "qwen2.5-coder", "inputTokens": 142, "outputTokens": 87, "durationMs": 1240, "agentId": "agent-qwen" }
```

### Semantic Memory

Agents store user-specific memories with vector embeddings (via Ollama `/api/embeddings`). Retrieval uses cosine similarity when embeddings are present, Jaccard fallback otherwise.

### Token Usage

Track spend per model per conversation:
```http
GET /api/conversations/:id/usage
→ { "qwen2.5-coder": { inputTokens: 450, outputTokens: 210 }, ... }
```

### Eval Harness

Run LLM-as-judge evaluations against `tests/evals/dataset.jsonl`:
```bash
npm run eval
# writes pass/fail report to logs/eval-report.jsonl
```

### OpenTelemetry

Set `OTEL_ENABLED=true` to emit spans to any OTLP-compatible backend (Jaeger, Tempo, Honeycomb). Start Jaeger locally:
```bash
docker compose --profile tracing up -d
# Jaeger UI → http://localhost:16686
```

## Project Structure

```
├── src/
│   ├── agents/
│   │   ├── manager/        # Central orchestrator (routing, auth, metrics)
│   │   ├── agent-llama3/   # General-purpose agent
│   │   ├── agent-mistral/  # Analytical agent
│   │   ├── agent-phi3/     # Creative agent
│   │   └── agent-qwen/     # Code agent
│   ├── shared/
│   │   ├── agent-base.js   # Base class (memory, streaming, HMAC verify)
│   │   ├── agent-config.js # Prompt versioning cache
│   │   ├── agentAuth.js    # HMAC-SHA256 sign/verify
│   │   ├── circuitBreaker.js
│   │   ├── llmTracer.js    # JSONL trace writer
│   │   ├── memory.js       # Semantic memory + embeddings
│   │   ├── modelRouter.js  # Content-aware model selection
│   │   ├── ollama.js       # Ollama client + retry
│   │   ├── retry.js        # Full-jitter exponential backoff
│   │   ├── summarizer.js   # Conversation summarization
│   │   └── tracing.js      # OpenTelemetry init
│   ├── middleware/
│   │   ├── auditLog.js     # Append-only audit.log
│   │   └── rateLimiter.js  # Redis-backed rate limits
│   ├── models/
│   │   ├── Conversation.js # Message + tokenUsage schema
│   │   ├── Memory.js       # Memory + embedding schema
│   │   ├── PromptVersion.js# Versioned system prompts
│   │   └── User.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── conversations.js
│   │   └── prompts.js
│   ├── monitoring/
│   │   └── metrics.js      # Prometheus (7 metrics + Node defaults)
│   ├── config/
│   │   ├── database.js
│   │   └── redis.js
│   ├── scripts/
│   │   └── evalHarness.js  # LLM-as-judge eval runner
│   └── utils/
│       ├── jwt.js
│       └── validateEnv.js  # Startup aborts on missing/weak secrets
├── multi-agent-chatbot/    # Next.js 15 frontend
│   └── app/chat/           # Chat UI with Socket.IO streaming
├── tests/
│   ├── unit/               # 32 Jest unit tests
│   └── e2e/                # 122 Jest e2e tests (supertest)
├── tests/evals/
│   └── dataset.jsonl       # 10 eval pairs for LLM-as-judge
├── logs/
│   ├── audit.log
│   ├── llm-traces.jsonl
│   └── eval-report.jsonl
├── docker-compose.yml      # Full stack (MongoDB, Redis, agents, frontend, Jaeger)
├── Dockerfile              # Backend image
├── multi-agent-chatbot/Dockerfile  # Frontend 3-stage build
└── .env.example
```

## Testing

```bash
npm test            # all 154 tests
npm run test:unit   # 32 unit tests
npm run test:e2e    # 122 e2e tests (auth, conversations, health, prompts)
npm run eval        # eval harness → logs/eval-report.jsonl
```

## Adding a New Agent

1. Copy `src/agents/agent-llama3/` to `src/agents/agent-{name}/`
2. Set `this.model` and `this.agentName` in the constructor
3. Add port to `.env` and agent URL to `docker-compose.yml`
4. Register in `src/agents/manager/index.js` agent map
5. Add routing keyword to `src/shared/modelRouter.js` if needed

## Security Notes

- `JWT_SECRET` and `AGENT_SHARED_SECRET` must be at least 32 characters — startup aborts if not
- All manager → agent HTTP calls are HMAC-SHA256 signed and verified
- Rate limits: 5 req/15 min (auth), 30 req/min (messages), 10 req/hour (exports)
- All auth events written to `logs/audit.log`
- `.env` is gitignored — never commit secrets

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- [Ollama](https://ollama.ai) — local LLM serving
- [Meta AI](https://ai.meta.com) — Llama models
- [Mistral AI](https://mistral.ai) — Mistral models
- [Microsoft](https://microsoft.com) — Phi-3 models
- [Alibaba](https://qwenlm.github.io) — Qwen models
