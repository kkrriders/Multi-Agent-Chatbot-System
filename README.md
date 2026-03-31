# Multi-Agent Chatbot System

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-98%20unit%20passing-brightgreen)](#testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](https://docs.docker.com/compose/)

A multi-agent chatbot where a central orchestrator routes your message to one of four specialized LLM agents, each backed by a different **Groq** model. Complex requests get broken into subtasks, farmed out to multiple agents in parallel, deduplicated, conflict-checked, and quality-reviewed before a single coherent answer comes back.

No GPU. No local model downloads. Get a free Groq API key and start in minutes.

---

## Table of Contents

- [What Makes This Different](#what-makes-this-different)
- [System Architecture](#system-architecture)
- [How a Message Flows](#how-a-message-flows)
- [The Multi-Agent Pipeline](#the-multi-agent-pipeline)
- [Core Modules](#core-modules)
- [The Four Agents](#the-four-agents)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Security](#security)
- [Extending the System](#extending-the-system)

---

## What Makes This Different

Most "multi-agent" demos just call multiple LLMs and concatenate the outputs. This system has real architecture:

| Capability | What it does |
|---|---|
| **3-tier intent routing** | LLM classification → TF-IDF cosine similarity → keyword regex, with caching and fallbacks |
| **Confidence-based fallback** | When routing confidence < 0.6, two agents are consulted in parallel and the higher-confidence answer wins |
| **Planning & decomposition** | Complex requests are broken into a dependency graph of subtasks, executed in topological waves |
| **Result aggregation** | Duplicate sentences across agents are removed (Jaccard ≥ 0.72), contradictions flagged, outputs synthesized into one coherent answer with inline `[agent-N]` citations |
| **Critic pass** | Before returning, a lightweight LLM evaluates completeness and correctness — and revises once if issues are found |
| **Shared memory** | A global memory tier lets agents share context across requests; a per-agent tier stores user-specific facts and preferences |
| **Resilience & observability** | Circuit breakers, retry with jitter, HMAC-signed agent calls, JWT auth, Redis rate limiting, Prometheus metrics, OpenTelemetry tracing |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Next.js Frontend  :3002                        │
│          React · TypeScript · Tailwind · Socket.IO              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ JWT auth · WebSocket (Socket.IO)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Manager  :3000                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Request Layer                                           │  │
│  │  JWT verify · Helmet · CSRF · Rate Limiting (Redis)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Routing Layer                                           │  │
│  │  IntentClassifier (3-tier) → routeModelWithFallback()    │  │
│  │  confidence ≥ 0.6 → single agent                         │  │
│  │  confidence < 0.6 → dual agents, pick best               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Orchestration Layer  (POST /plan-and-execute)           │  │
│  │  PlannerAgent → decompose → execute waves → aggregate    │  │
│  │  → criticPass → final answer                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│  Circuit Breakers · HMAC-signed HTTP · Retry (exp. backoff)     │
└──────┬───────────┬───────────┬───────────┬──────────────────────┘
       │           │           │           │
  ┌────▼───┐  ┌───▼────┐  ┌───▼────┐  ┌───▼────┐
  │agent-1 │  │agent-2 │  │agent-3 │  │agent-4 │
  │ :3005  │  │ :3006  │  │ :3007  │  │ :3008  │
  │general │  │analyst │  │creative│  │  code  │
  └────┬───┘  └───┬────┘  └───┬────┘  └───┬────┘
       └───────────┴───────────┴───────────┘
                          │
                 ┌────────▼────────┐
                 │   Groq Cloud     │
                 │  llama3-8b       │  ← agent-1
                 │  mixtral-8x7b    │  ← agent-2
                 │  gemma2-9b       │  ← agent-3
                 │  llama3-70b      │  ← agent-4, planner, critic
                 └─────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
  ┌────▼─────┐     ┌──────▼──────┐    ┌──────▼──────┐
  │ MongoDB  │     │    Redis     │    │   Jaeger     │
  │  :27017  │     │   :6379      │    │  :16686      │
  │users     │     │rate limits   │    │(optional)    │
  │convs     │     │session cache │    │OTEL tracing  │
  │memory    │     └─────────────┘    └─────────────┘
  │prompts   │
  └──────────┘
```

---

## How a Message Flows

### Standard request (`POST /message` with `agentId: "auto"`)

```
User types: "explain async/await in JavaScript"
       │
       ▼
1. ROUTING
   IntentClassifier.classifyIntent()
   ├─ Tier 1 (LLM): llama3-8b → { agent: "specialist", confidence: 0.87 }
   │  confidence ≥ 0.6 → use this result
   └─ Returns: { agentId: "agent-4", model: "llama3-70b-8192",
                 confidence: 0.87, secondCandidate: { agentId: "agent-1" } }

2. SIGN + DISPATCH
   Manager signs request body with HMAC-SHA256
   → POST http://localhost:3008/message  (agent-4)

3. AGENT PROCESSES
   agent-4 verifies HMAC signature
   → merges sharedMemory context into system prompt
   → appends per-user memory (preferences, past conversations)
   → calls Groq (llama3-70b-8192)
   → returns { content, confidence: 88, tokenUsage }

4. RESPOND
   Manager stores conversation in MongoDB
   → emits stream-end via Socket.IO
   → returns HTTP response with routing metadata
```

### Low-confidence fallback

```
User types: "help me with this"   ← ambiguous
       │
       ▼
IntentClassifier → { agentId: "agent-1", confidence: 0.41 }
   confidence < 0.6 → LOW CONFIDENCE
       │
       ▼
consultDualAgents("agent-1", secondCandidate)
   ├─ routeMessageToAgent(agent-1) ─────┐  parallel
   └─ routeMessageToAgent(agent-2) ─────┘
       │
       ▼
Pick winner by response.confidence (0–100 scale)
Emit winning response via Socket.IO with fallbackUsed: true
```

---

## The Multi-Agent Pipeline

### `POST /plan-and-execute`

Used for complex requests that benefit from multiple agents working together.

```
User: "analyze the pros and cons of React vs Vue, then write
       a summary a junior dev could understand"
       │
       ▼
┌─────────────────────────────────────────────────────┐
│ 1. DECOMPOSE  (PlannerAgent.decompose)               │
│                                                      │
│   Groq (llama3-70b, JSON mode) returns:             │
│   tasks: [                                           │
│     { id:"t1", agent:"agent-2",                     │
│       desc:"Analyze React vs Vue pros/cons",         │
│       dependsOn:[] },                                │
│     { id:"t2", agent:"agent-3",                     │
│       desc:"Write junior-friendly summary",          │
│       dependsOn:["t1"] }                             │
│   ]                                                  │
│   Socket.IO → planner-plan-ready                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ 2. EXECUTE  (PlannerAgent.execute)                  │
│                                                      │
│   buildExecutionWaves(tasks) →                      │
│     Wave 1: [t1]   (no dependencies)               │
│     Wave 2: [t2]   (waits for t1)                  │
│                                                      │
│   Wave 1: POST agent-2/message  → "React has..."   │
│   Wave 2: POST agent-3/message  (gets t1 context)  │
│           → "Here's a simple summary..."            │
│                                                      │
│   Socket.IO → planner-task-start / planner-task-complete
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ 3. AGGREGATE  (aggregator.aggregate)                │
│                                                      │
│   deduplicate()   → remove near-identical sentences │
│                     (Jaccard similarity ≥ 0.72)     │
│   detectConflicts() → flag contradictions between   │
│                       agents                        │
│   LLM synthesis  → Groq combines with instructions: │
│     - cite sources inline [agent-2], [agent-3]     │
│     - resolve conflicts explicitly                  │
│     - no duplicate information                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ 4. CRITIC PASS  (criticAgent.criticPass)            │
│                                                      │
│   critique() — llama3-8b evaluates:                 │
│     Completeness: did it answer all parts?          │
│     Correctness:  any obvious factual errors?       │
│     Clarity:      coherent? no hallucinations?      │
│     → score: 8/10, approved: true                   │
│                                                      │
│   If not approved → revise() with llama3-70b once  │
│   Socket.IO → planner-critic-done                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│ 5. RETURN                                           │
│                                                      │
│   Socket.IO → stream-end (finalResponse)            │
│   HTTP → {                                          │
│     finalResponse: "...",                           │
│     plan: { tasks: [...] },                         │
│     aggregation: { removed: 3, conflictsFound: 0 }, │
│     critic: { approved: true, score: 8 }            │
│   }                                                  │
└─────────────────────────────────────────────────────┘
```

---

## Core Modules

### `src/shared/intentClassifier.js`
Three-tier intent classification with in-process caching.

| Tier | Method | Latency | Fallback trigger |
|---|---|---|---|
| 1 | LLM (llama3-8b, JSON mode) | ~500ms | Error or confidence < 0.6 |
| 2 | TF-IDF cosine similarity (local, 80-term vocab) | < 1ms | Score ≤ 0.05 |
| 3 | Keyword regex rules | < 1ms | Always succeeds |

Results cached in-process: 200-entry LRU, 5-minute TTL.
Returns `secondCandidate` (2nd-best agent by TF-IDF rank) for use by the fallback path.

### `src/shared/modelRouter.js`

| Function | When to use |
|---|---|
| `routeModel(msg)` | Synchronous, zero latency — used inside agents during JSON-mode generation |
| `routeModelAsync(msg)` | Full 3-tier classification — used by manager endpoints |
| `routeModelWithFallback(msg)` | Returns `{ primary, secondary, isLowConfidence }` — drives dual-agent consultation |

### `src/shared/plannerAgent.js`
Dependency-injected orchestrator. Takes `executeTask` and `emit` callbacks to avoid circular imports and stay unit-testable.

Key invariants:
- Task `dependsOn` arrays are never mutated (immutable pattern)
- Circular dependencies resolved at runtime (unsatisfiable deps stripped, tasks run independently)
- Concurrency capped at `MAX_PARALLEL = 2` to stay within Groq's 30 req/min per model

### `src/shared/aggregator.js`
Transforms raw multi-agent outputs into a single clean answer.

```
inputs: Map<taskId, { agentId, content }>
  │
  ├─ filter error-only outputs
  ├─ deduplicate(): Jaccard ≥ 0.72 (punctuation-stripped tokenization)
  ├─ detectConflicts(): negation-pair patterns on high-overlap sentences
  ├─ buildAggregationPrompt(): explicit dedup + conflict + citation instructions
  └─ LLM synthesis (llama3-70b) → answer with [agent-N] inline citations

fallback: concatenate kept sentences if LLM fails
safety net: never returns empty string
```

### `src/shared/criticAgent.js`
Quality-control pass added after synthesis for multi-task plans.

```
criticPass(draft, originalQuestion):
  critique()  → llama3-8b, score 0–10
                checks: completeness, correctness, clarity
                auto-approves if LLM fails (never blocks)
  if approved → return draft unchanged
  if issues   → revise() with llama3-70b (one pass, never more)
  return { finalAnswer, approved, revised, score, issues }
```

### `src/shared/sharedMemory.js`
Two-tier shared memory broker.

| Tier | Scope | Storage |
|---|---|---|
| Global | All agents | In-process Array + MongoDB (synthetic OID) |
| Agent | Per-agent × per-user | Delegates to `AgentMemory` |

`mergeContextForAgent(agentId, userId, query)` returns a ready-to-inject string block for agent system prompts, querying both tiers in parallel.

### `src/shared/agent-base.js`
Base class for all four agents. Provides:
- Express setup with CORS, raw-body capture (for HMAC), morgan
- `POST /message` — HMAC-verified, memory-aware message handling
- `POST /message/stream` — SSE token streaming
- `GET /status` — public health check
- `createPrompt()` — injects shared memory + agent memory + preferences into system prompt
- `generateAgentResponse()` — JSON-mode LLM call, structured `{ answer, confidence }` output
- `extractAndStorePreferences()` — LLM-based preference extraction (replaces heuristic regex)

### `src/shared/voting.js`
Agent consensus for team conversations. Supports `MAJORITY`, `WEIGHTED`, `CONSENSUS`, and `RANKED_CHOICE` strategies. Returns `{ winner, winnerProposal, voteCounts, confidence }`.

### `src/shared/circuitBreaker.js`
Per-agent circuit breaker: `CLOSED → OPEN` after 3 consecutive failures → `HALF_OPEN` after 30s. Each state change is mirrored into Prometheus immediately via the `stateChange` event.

---

## The Four Agents

Each agent is a standalone Express service with its own port, model, personality, and memory.

| Agent | Port | Model | Role | Temperature |
|---|---|---|---|---|
| `agent-1` (agent-llama3) | 3005 | `llama3-8b-8192` | General assistant — factual Q&A, explanations, casual help | 0.7 |
| `agent-2` (agent-mistral) | 3006 | `mixtral-8x7b-32768` | Analyst — data, research, comparisons, 32k context | 0.3 |
| `agent-3` (agent-phi3) | 3007 | `gemma2-9b-it` | Creative — stories, poems, brainstorming, design | 0.9 |
| `agent-4` (agent-qwen) | 3008 | `llama3-70b-8192` | Specialist — code, debugging, algorithms, technical depth | 0.5 |

All model IDs are overridable via `AGENT_{N}_MODEL` env vars. No code changes needed.

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/your-username/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system
cp .env.example .env
# Set JWT_SECRET, AGENT_SHARED_SECRET, GROQ_API_KEY in .env
docker compose up -d
```

With distributed tracing (Jaeger):
```bash
docker compose --profile tracing up -d
```

| URL | Service |
|---|---|
| `http://localhost:3002` | Chat frontend |
| `http://localhost:3000` | Manager API (REST + WebSocket) |
| `http://localhost:3000/metrics` | Prometheus metrics |
| `http://localhost:3000/api/health` | Health check |
| `http://localhost:16686` | Jaeger tracing UI |

### Option B — Local Development

**Prerequisites:** Node.js 18+, MongoDB, Redis, [Groq API key](https://console.groq.com) (free)

```bash
# Install
npm install
cd multi-agent-chatbot && npm install && cd ..

# Configure
cp .env.example .env
# Fill in: JWT_SECRET, AGENT_SHARED_SECRET, MONGODB_URI, GROQ_API_KEY

# Start MongoDB + Redis
docker run -d -p 27017:27017 mongo:7
docker run -d -p 6379:6379 redis:7

# Start all backend services
npm run dev

# Or start frontend too
npm run start-with-frontend
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Free at [console.groq.com](https://console.groq.com) — starts with `gsk_` |
| `JWT_SECRET` | **Yes** | Min 32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AGENT_SHARED_SECRET` | **Yes** | Min 32 chars. Same generation command. Signs manager→agent HTTP calls |
| `MONGODB_URI` | **Yes** | MongoDB connection string |
| `FRONTEND_URL` | **Yes** | Allowed CORS origin (default: `http://localhost:3002`) |
| `REDIS_URL` | No | Falls back to in-memory rate limiting if unset |
| `MANAGER_PORT` | No | Default `3000` |
| `AGENT_1_PORT` – `AGENT_4_PORT` | No | Defaults `3005`–`3008` |
| `AGENT_1_MODEL` – `AGENT_4_MODEL` | No | Groq model IDs (see `.env.example` for defaults) |
| `AGENT_1_URL` – `AGENT_4_URL` | Docker only | Set automatically by `docker-compose.yml` |
| `OTEL_ENABLED` | No | `true` to emit OpenTelemetry spans to Jaeger |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` (default: `info`) |

Startup **aborts** if `JWT_SECRET`, `AGENT_SHARED_SECRET`, or `GROQ_API_KEY` are missing or too short.

---

## API Reference

### Authentication

```http
POST /auth/register    Body: { fullName, email, password }
POST /auth/login       Body: { email, password }
```

Both return `{ token }`. Include as `Authorization: Bearer <token>` or automatically via httpOnly cookie.

### Messaging

```http
POST /message
{ "content": "explain async/await", "conversationId": "<id>", "agentId": "auto" }
```

`agentId` options: `"auto"` (intelligent routing), `"agent-1"` through `"agent-4"` (direct).

```http
POST /plan-and-execute
{ "content": "analyze X and write a summary", "conversationId": "<id>" }
```

Runs the full planner pipeline: decompose → execute → aggregate → critic.

```http
POST /team-conversation
{ "content": "compare REST vs GraphQL", "participants": [{ "agentId": "agent-1" }, { "agentId": "agent-2" }] }
```

### Conversations

```http
GET    /api/conversations              # list user's conversations
GET    /api/conversations/:id          # full history
PUT    /api/conversations/:id          # update title, tags, status
DELETE /api/conversations/:id          # delete
POST   /api/conversations/:id/export   # export to PDF
GET    /api/conversations/:id/usage    # token usage by model
```

### Prompt Versioning

```http
GET    /api/prompts                    # list all prompt versions
POST   /api/prompts                    # create version { agentId, systemPrompt, description }
POST   /api/prompts/:id/activate       # set as active prompt for that agent
DELETE /api/prompts/:id
```

### Monitoring

```http
GET /api/health     # MongoDB, Redis, agents, circuit breaker states
GET /metrics        # Prometheus metrics (Prometheus text format)
```

### WebSocket (Socket.IO)

```javascript
const socket = io('http://localhost:3000', { auth: { token } });

socket.emit('join-conversation', conversationId);

// Standard message — tokens stream in real-time
socket.on('agent-thinking',  ({ agentId }) => showSpinner());
socket.on('stream-start',    ({ messageId, agentId }) => openBubble());
socket.on('stream-token',    ({ token }) => appendToken());
socket.on('stream-end',      ({ content, agentId, confidence }) => finalize());
socket.on('stream-error',    ({ agentId }) => showError());

// Plan-and-execute events
socket.on('planner-decomposing',   () => showPlanSpinner());
socket.on('planner-plan-ready',    ({ tasks }) => renderTaskList());
socket.on('planner-task-start',    ({ taskId, agentId }) => markActive());
socket.on('planner-task-complete', ({ taskId, contentPreview }) => markDone());
socket.on('planner-synthesizing',  () => showSynthesisSpinner());
socket.on('planner-critic-done',   ({ score, approved }) => showQuality());
```

---

## Project Structure

```
├── src/
│   ├── agents/
│   │   ├── manager/             # Central orchestrator (REST API + Socket.IO)
│   │   ├── agent-llama3/        # Agent 1 — general (llama3-8b)
│   │   ├── agent-mistral/       # Agent 2 — analyst (mixtral-8x7b)
│   │   ├── agent-phi3/          # Agent 3 — creative (gemma2-9b)
│   │   └── agent-qwen/          # Agent 4 — specialist (llama3-70b)
│   │
│   ├── shared/
│   │   ├── intentClassifier.js  # 3-tier routing (LLM → TF-IDF → regex)
│   │   ├── modelRouter.js       # routeModel / routeModelAsync / routeModelWithFallback
│   │   ├── plannerAgent.js      # Decompose → execute waves → synthesize
│   │   ├── aggregator.js        # Dedup + conflict detection + LLM synthesis
│   │   ├── criticAgent.js       # Quality check (critique + optional revision)
│   │   ├── sharedMemory.js      # Global + per-agent memory broker
│   │   ├── memory.js            # Per-agent MongoDB memory (cosine/Jaccard search)
│   │   ├── agent-base.js        # Base class: memory, streaming, HMAC verify
│   │   ├── ollama.js            # Groq API client (drop-in for Ollama interface)
│   │   ├── voting.js            # Agent consensus (majority/weighted/consensus)
│   │   ├── agentAuth.js         # HMAC-SHA256 sign/verify
│   │   ├── circuitBreaker.js    # CLOSED/OPEN/HALF_OPEN per agent
│   │   ├── retry.js             # Exponential backoff with full jitter
│   │   ├── messaging.js         # FIPA-ACL performative protocol
│   │   ├── summarizer.js        # Conversation summarisation (long histories)
│   │   ├── agent-config.js      # Dynamic per-agent configuration + prompt versioning
│   │   ├── llmTracer.js         # JSONL trace writer (every LLM call)
│   │   ├── tracing.js           # OpenTelemetry instrumentation
│   │   └── logger.js            # Structured Winston logging
│   │
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── rateLimiter.js       # 5 Redis-backed rate limiters
│   │   └── auditLog.js          # Append-only compliance log
│   │
│   ├── models/
│   │   ├── User.js              # Auth schema
│   │   ├── Conversation.js      # Messages + token usage
│   │   ├── Memory.js            # Agent memory entries + embeddings
│   │   └── PromptVersion.js     # Versioned system prompts
│   │
│   ├── routes/
│   │   ├── auth.js              # /auth/register, /auth/login
│   │   ├── conversations.js     # CRUD + PDF export + token usage
│   │   └── prompts.js           # Prompt version management
│   │
│   ├── monitoring/
│   │   └── metrics.js           # Prometheus (7 custom + Node.js runtime metrics)
│   │
│   └── config/
│       ├── database.js          # MongoDB connection
│       └── redis.js             # Redis client
│
├── multi-agent-chatbot/         # Next.js 15 frontend
│   ├── app/
│   │   ├── chat/page.tsx        # Main chat UI with Socket.IO streaming
│   │   ├── dashboard/page.tsx   # Conversation history
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── Dockerfile               # 3-stage build (deps → builder → runner)
│
├── tests/
│   ├── unit/shared/
│   │   ├── intentClassifier.test.js   # 14 cases
│   │   ├── modelRouter.test.js        # 13 cases
│   │   ├── aggregator.test.js         # 14 cases
│   │   ├── criticAgent.test.js        # 12 cases
│   │   ├── plannerAgent.test.js       # 10 cases
│   │   ├── retry.test.js
│   │   ├── circuitBreaker.test.js
│   │   └── agentAuth.test.js
│   ├── e2e/                           # Supertest e2e (auth, conversations, health)
│   └── evals/
│       └── dataset.jsonl              # 18 eval pairs (routing + quality)
│
├── config/
│   └── agent-configs.json       # Per-agent system prompts, temperature, max tokens
├── logs/
│   ├── audit.log                # Authentication events
│   ├── llm-traces.jsonl         # Every LLM call (model, tokens, latency)
│   └── eval-report.jsonl        # Eval harness output
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Testing

```bash
npm run test:unit     # 98 unit tests (Jest, no network calls)
npm run test:e2e      # e2e tests — auth, conversations, health, prompts
npm run eval          # LLM-as-judge eval → logs/eval-report.jsonl
```

The unit tests mock all external dependencies (Groq, MongoDB, logger). They run in under 1 second with no environment setup needed.

### Coverage areas

| Module | Cases | What's tested |
|---|---|---|
| `intentClassifier` | 14 | All 3 tiers, cache, NaN safety, secondCandidate |
| `modelRouter` | 13 | Sync/async routing, fallback, NaN confidence guard |
| `aggregator` | 14 | Dedup, conflict detection, LLM failure, empty answer safety |
| `criticAgent` | 12 | Approve/reject, revision, LLM failure auto-approve |
| `plannerAgent` | 10 | Wave ordering, dependency injection, mutation safety, circular deps |
| `retry` | 5 | Backoff, error codes, exhaustion |
| `circuitBreaker` | 7 | State transitions, recovery |
| `agentAuth` | 7 | Sign/verify, tamper detection |

---

## Security

| Control | Implementation |
|---|---|
| **JWT authentication** | HS256, 7-day expiry, httpOnly cookie + Bearer header |
| **Agent request signing** | HMAC-SHA256 of raw request body, verified before processing |
| **Rate limiting** | Redis-backed: 5/15m auth, 30/min messages, 5/hr exports, 20/hr new conversations |
| **CSRF protection** | Origin header checked against `FRONTEND_URL` on all state-changing requests |
| **Security headers** | Helmet: CSP, HSTS (1yr), X-Frame-Options, referrer policy |
| **Input validation** | All request bodies validated at boundaries; HTML-escaped before rendering |
| **Password hashing** | bcrypt cost factor 10 |
| **Audit logging** | All auth events written to `logs/audit.log` (IP, user agent, timestamp) |
| **Secret validation** | Process aborts at startup if `JWT_SECRET`, `AGENT_SHARED_SECRET`, or `GROQ_API_KEY` missing/short |
| **XSS prevention** | `escapeHtml()` on user-generated content in rendered output |

---

## Extending the System

### Add a new agent

1. Copy `src/agents/agent-llama3/` → `src/agents/agent-{name}/`
2. Set `this.model` (any Groq model ID) and `this.personality` in the constructor
3. Add port to `.env` and a service block to `docker-compose.yml`
4. Add the endpoint to `AGENT_ENDPOINTS` in `src/agents/manager/index.js`
5. Add routing keywords to `AGENT_PROFILES` in `src/shared/intentClassifier.js`

### Swap a model

Set `AGENT_{N}_MODEL=<groq-model-id>` in `.env`. Available models: [console.groq.com/docs/models](https://console.groq.com/docs/models). No code changes needed.

### Lower the confidence threshold

```bash
# .env
LOW_CONFIDENCE_THRESHOLD=0.7   # consult two agents more often
```

Or edit `LOW_CONFIDENCE_THRESHOLD` in `src/shared/modelRouter.js`.

### Disable the critic pass

Remove the `criticPass` call in `src/shared/plannerAgent.js` `plan()` method, or guard it with an env flag.

---

## Acknowledgments

- [Groq](https://groq.com) — fast, free-tier cloud inference that makes this architecture practical
- [Meta AI](https://ai.meta.com) — Llama 3 models
- [Mistral AI](https://mistral.ai) — Mixtral models
- [Google DeepMind](https://deepmind.google) — Gemma models

---

## License

[MIT](LICENSE)
