# Multi-Agent Chatbot System

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A distributed AI system built around a central manager that intelligently routes user messages to one of four specialized LLM agents, each backed by a distinct Groq model. The system supports three execution modes: direct routing to the best-fit agent, parallel multi-agent planning with dependency-ordered execution, and a structured debate cycle where agents propose, challenge, and defend positions before a synthesized answer is returned.

No GPU required. Requires only a Groq API key, MongoDB, and Redis.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Information Flow](#information-flow)
  - [Standard Message Routing](#standard-message-routing)
  - [Low-Confidence Fallback](#low-confidence-fallback)
  - [Plan & Execute](#plan--execute)
  - [Debate Mode](#debate-mode)
- [Core Modules](#core-modules)
- [Agents & Models](#agents--models)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Security](#security)
- [Extending the System](#extending-the-system)

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend  :3002                          │
│           TypeScript · Tailwind CSS · Socket.IO client               │
│   /login   /signup   /dashboard   /chat                              │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  JWT · Socket.IO (WebSocket)
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Manager  :3099                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Request Layer                                                  │ │
│  │  JWT verify · Helmet · Origin/CSRF check · Redis rate limiting  │ │
│  │  Audit logging · OpenTelemetry tracing                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                             │                                        │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  Routing Layer           │                                   │   │
│  │                          ▼                                   │   │
│  │  IntentClassifier  →  confidence ≥ 0.6?                      │   │
│  │  (LLM→TF-IDF→regex)      │                                   │   │
│  │                    YES   │   NO                              │   │
│  │                    ▼         ▼                               │   │
│  │              single agent   consultDualAgents()              │   │
│  │                             pick higher-confidence response  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                        │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  Orchestration Layer     │   (POST /plan-and-execute)        │   │
│  │                          ▼                                   │   │
│  │  PlannerAgent → decompose → topological waves → aggregate    │   │
│  │               → criticPass → final answer                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                        │
│  ┌──────────────────────────┼───────────────────────────────────┐   │
│  │  Debate Layer            │   (POST /debate)                  │   │
│  │                          ▼                                   │   │
│  │  DebateEngine → proposal → challenge → defense → synthesis   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                        │
│        CircuitBreaker · HMAC-signed HTTP · Retry (exp. backoff)      │
└──────┬────────────┬────────────┬────────────┬────────────────────────┘
       │            │            │            │  HMAC-SHA256 signed HTTP
  ┌────▼───┐   ┌───▼────┐   ┌───▼────┐   ┌───▼────┐
  │agent-1 │   │agent-2 │   │agent-3 │   │agent-4 │
  │ :3001  │   │ :3006  │   │ :3007  │   │ :3008  │
  │general │   │analyst │   │creative│   │special.│
  └────┬───┘   └───┬────┘   └───┬────┘   └───┬────┘
       └────────────┴────────────┴────────────┘
                          │
                   Groq Cloud API
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
      MongoDB           Redis          OpenTelemetry
      :27017            :6379          (Jaeger, optional)
  users, convs,     rate limits,
  memory, prompts   session cache
```

---

## Information Flow

### Standard Message Routing

```
User submits a message
        │
        ▼
Manager: JWT verification + rate limiting
        │
        ▼
IntentClassifier.classifyIntent(text)
  ┌─────────────────────────────────────────────────────────┐
  │  Tier 1 — LLM (llama-3.1-8b, JSON mode)      ~500ms    │
  │  Tier 2 — TF-IDF cosine similarity (local)    < 1ms    │
  │  Tier 3 — Keyword regex (hard fallback)        < 1ms   │
  │  Cache   — in-process Map, 5-min TTL, 200 entries      │
  └──────────────────────────┬──────────────────────────────┘
                             │
                     { agentId, confidence, secondCandidate }
                             │
               confidence ≥ 0.6?
                    │              │
                   YES             NO
                    ▼              ▼
             single agent    consultDualAgents(primary, secondary)
                             ├── agent A  ──┐  Promise.allSettled
                             └── agent B  ──┘
                                            ▼
                                   pick higher confidence
                             fallbackUsed: true in response
                    │              │
                    └──────┬───────┘
                           ▼
              CircuitBreaker.execute(agentId)
              ├── CLOSED   → pass through
              ├── OPEN     → fail fast (skip agent)
              └── HALF_OPEN → one probe request
                           │
                           ▼
              withRetry() — 3 attempts, 500ms→10s backoff
                           │
                           ▼
              Agent receives HMAC-signed HTTP request
              Verifies signature before processing
                           │
                           ▼
              Agent builds prompt:
              ├── system prompt (from agent-config)
              ├── sharedMemory context (cross-agent)
              ├── per-user memory (preferences, history)
              └── conversation history
                           │
                           ▼
              Groq API call → { answer, confidence }
                           │
                           ▼
              Manager persists to MongoDB
              Emits via Socket.IO:
                stream-start → [stream-token × N] → stream-end
```

---

### Low-Confidence Fallback

Triggered when `IntentClassifier` returns `confidence < 0.6` (e.g., ambiguous input like "help me with this").

```
{ agentId: "agent-1", confidence: 0.41, secondCandidate: { agentId: "agent-2" } }
        │
        ▼
consultDualAgents("agent-1", "agent-2", message, conversationId)
        │
        ├── POST agent-1/message ─────┐
        └── POST agent-2/message ─────┘  Promise.allSettled (parallel)
                                          handles partial failures
        │
        ▼
winner = response with higher confidence score (0–100)
        │
        ▼
Socket.IO → stream-start + stream-end
  { fallbackUsed: true, originalAgent: "agent-1", agentId: "agent-2" }
```

---

### Plan & Execute

`POST /plan-and-execute` — for requests that span multiple domains (e.g., research + code + summary).

```
User: "Analyze the tradeoffs of REST vs GraphQL, then write
       an implementation guide for a Node.js developer"
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ 1. DECOMPOSE  (PlannerAgent.decompose)                 │
│                                                        │
│  llama-3.3-70b (JSON mode) returns a task graph:      │
│  [                                                     │
│    { id:"t1", agentLabel:"analyst",    deps:[] },      │
│    { id:"t2", agentLabel:"specialist", deps:["t1"] },  │
│    { id:"t3", agentLabel:"general",    deps:["t2"] }   │
│  ]                                                     │
│  Socket.IO → planner-plan-ready                       │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│ 2. EXECUTE  (topological waves, max 2 concurrent)      │
│                                                        │
│  Wave 1: [t1]          → agent-2 (analyst)            │
│  Wave 2: [t2]          → agent-4 (specialist)         │
│  Wave 3: [t3]          → agent-1 (general)            │
│                                                        │
│  Each wave waits for its dependencies.                 │
│  Task results are passed forward as context.           │
│  Socket.IO → planner-task-start, planner-task-complete │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│ 3. AGGREGATE  (aggregator.aggregate)                   │
│                                                        │
│  deduplicate()     — Jaccard ≥ 0.72 sentence removal  │
│  detectConflicts() — flags factual contradictions     │
│  LLM synthesis     — merges with [agent-N] citations  │
│  fallback          — concatenates if LLM fails        │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────┐
│ 4. CRITIC PASS  (criticAgent.criticPass)               │
│                                                        │
│  critique()  — llama-3.1-8b scores 0–10               │
│                checks: completeness, correctness,      │
│                clarity, no hallucinations              │
│  approved    — return draft unchanged                  │
│  not approved — revise() once with llama-3.3-70b      │
│  auto-approves if LLM fails (never blocks)            │
│  Socket.IO → planner-critic-done                      │
└──────────────────────────┬────────────────────────────┘
                           │
                           ▼
          { finalResponse, plan, aggregation, critic }
```

---

### Debate Mode

`POST /debate` — all agents engage in a structured 4-phase argument cycle. Useful when exploring a controversial or multi-perspective topic.

```
User message
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 1 — Proposal  (parallel)                         │
│                                                        │
│  Agent-1, 2, 3, 4 each answer independently.          │
│  Promise.allSettled — partial failures handled.        │
│  Agents with OPEN circuit breakers are skipped.        │
└──────────────────────────┬─────────────────────────────┘
                           │ proposals[]
                           ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 2 — Challenge  (JSON mode)                       │
│                                                        │
│  Each agent reads all other proposals and issues       │
│  1–2 claim-level challenges (not style critiques).    │
│  Sycophancy guard: if 0 challenges are returned,      │
│  a fallback challenge is auto-injected.               │
└──────────────────────────┬─────────────────────────────┘
                           │ challenges[]
                           ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 3 — Defense  (only challenged agents respond)    │
│                                                        │
│  Each challenged agent selects one stance:            │
│    defend  — refute with evidence                     │
│    concede — accept, revise position                  │
│    partial — partly agree, partly defend              │
└──────────────────────────┬─────────────────────────────┘
                           │ defenses[]
                           ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 4 — Synthesis                                    │
│                                                        │
│  aggregate() — dedup + conflict resolution             │
│               unified answer with [agent-N] tags      │
│  criticPass() — second LLM pass patches gaps          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
               Final answer → Socket.IO → UI
```

---

## Core Modules

### `src/shared/intentClassifier.js`
Three-tier classification with in-process caching.

| Tier | Method | Latency | Fallback trigger |
|---|---|---|---|
| 1 | LLM (llama-3.1-8b, JSON mode) | ~500ms | Error or confidence < 0.6 |
| 2 | TF-IDF cosine similarity (local, 80-term vocab) | < 1ms | Score ≤ 0.05 |
| 3 | Keyword regex | < 1ms | Always succeeds |

Returns `secondCandidate` (second-best agent) for use by the dual-agent fallback path. NaN confidence is guarded at both the classifier and router levels.

---

### `src/shared/modelRouter.js`

| Function | Behavior |
|---|---|
| `routeModel(msg)` | Synchronous keyword-regex only — used inside agents during JSON-mode generation |
| `routeModelAsync(msg)` | Full 3-tier classification — used by manager endpoints |
| `routeModelWithFallback(msg)` | Returns `{ primary, secondary, isLowConfidence }` — drives dual-agent consultation |

`LOW_CONFIDENCE_THRESHOLD` defaults to `0.6` and is configurable via env.

---

### `src/shared/plannerAgent.js`
Receives `executeTask` and `emit` as injected callbacks — no circular imports, fully unit-testable.

- Task `dependsOn` arrays are never mutated
- Circular dependencies are resolved at runtime (unsatisfiable deps are dropped; tasks run independently)
- Concurrency capped at `MAX_PARALLEL = 2` to respect Groq's per-model rate limits

---

### `src/shared/aggregator.js`

```
inputs: Map<taskId, { agentId, content }>
  ├── filter error-only outputs
  ├── deduplicate()     — Jaccard ≥ 0.72 on punctuation-stripped tokens
  ├── detectConflicts() — negation-pair patterns on high-overlap sentences
  ├── buildPrompt()     — explicit dedup + conflict + citation instructions
  └── LLM synthesis (llama-3.3-70b) → answer with [agent-N] inline citations

fallback: concatenate kept sentences if LLM call fails
safety:   never returns an empty string
```

---

### `src/shared/criticAgent.js`

```
criticPass(draft, originalQuestion):
  critique()  → llama-3.1-8b, score 0–10
                checks: completeness, correctness, clarity
                auto-approves on LLM failure (never blocks pipeline)
  approved    → return draft unchanged
  issues      → revise() once with llama-3.3-70b (one pass only)
  returns { finalAnswer, approved, revised, score, issues }
```

---

### `src/shared/sharedMemory.js`
Two-tier memory broker.

| Tier | Scope | Backing store |
|---|---|---|
| Global | All agents | In-process Array + MongoDB |
| Agent | Per-agent × per-user | `AgentMemory` (MongoDB-backed) |

`mergeContextForAgent(agentId, userId, query)` queries both tiers in parallel and returns a string block ready to inject into the agent system prompt.

---

### `src/shared/agent-base.js`
Base class for all four agents:
- Express setup with raw-body capture (required for HMAC verification)
- `POST /message` — HMAC-verified, memory-aware, structured JSON response
- `POST /message/stream` — SSE token streaming
- `GET /status` — health check
- `createPrompt()` — injects shared memory + user memory + config into system prompt
- `generateAgentResponse()` — returns `{ answer, confidence }` via JSON-mode Groq call
- `extractAndStorePreferences()` — LLM-based extraction of user preferences from exchanges

---

### `src/shared/circuitBreaker.js`
Per-agent state machine: `CLOSED → OPEN` after 3 consecutive failures, `OPEN → HALF_OPEN` after 30s, one probe request to determine recovery. Each state transition emits a `stateChange` event that updates Prometheus immediately.

---

### `src/shared/voting.js`
Consensus mechanism for team conversations. Strategies: `MAJORITY`, `WEIGHTED`, `CONSENSUS` (requires > 75% agreement), `RANKED_CHOICE`. Returns `{ winner, winnerProposal, voteCounts, confidence }`.

---

## Agents & Models

Each agent runs as an independent Express service. The manager communicates with agents over HMAC-signed HTTP.

| Agent | Port | Default Model | Specialty |
|---|---|---|---|
| agent-1 | 3001 | `llama-3.1-8b-instant` | General Q&A, factual questions, conversational |
| agent-2 | 3006 | `qwen/qwen3-32b` | Analysis, research, structured comparison |
| agent-3 | 3007 | `meta-llama/llama-4-scout-17b-16e-instruct` | Creative writing, brainstorming, ideation |
| agent-4 | 3008 | `llama-3.3-70b-versatile` | Code, debugging, algorithmic and technical tasks |

All model IDs are overridable via environment variables — no code changes required.

---

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB
- Redis
- Groq API key (free tier available)

### Install

```bash
git clone https://github.com/kkrriders/multi-agent-chatbot-system.git
cd multi-agent-chatbot-system
npm install
cd multi-agent-chatbot && npm install && cd ..
cp .env.example .env
# Edit .env — set GROQ_API_KEY, JWT_SECRET, AGENT_SHARED_SECRET, MONGODB_URI
```

### Start

```bash
# All 5 backend services in one terminal (manager + 4 agents)
npm run dev

# With Next.js frontend
npm run start-with-frontend

# Individually
npm run start-manager
npm run start-agent-1
npm run start-agent-2
npm run start-agent-3
npm run start-agent-4
```

### Service Ports

| Service | Port |
|---|---|
| Manager API | 3099 |
| Agent 1 (General) | 3001 |
| Agent 2 (Analyst) | 3006 |
| Agent 3 (Creative) | 3007 |
| Agent 4 (Specialist) | 3008 |
| Next.js Frontend | 3002 |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key — starts with `gsk_` |
| `JWT_SECRET` | Yes | Min 32 chars. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AGENT_SHARED_SECRET` | Yes | Min 32 chars. HMAC key for manager→agent request signing |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `FRONTEND_URL` | Yes | Allowed CORS origin (e.g. `http://localhost:3002`) |
| `REDIS_URL` | No | Falls back to in-memory rate limiting if omitted |
| `MANAGER_PORT` | No | Default `3099` |
| `AGENT_1_PORT` – `AGENT_4_PORT` | No | Defaults `3001`, `3006`, `3007`, `3008` |
| `AGENT_1_MODEL` – `AGENT_4_MODEL` | No | Override Groq model per agent |
| `DEBATE_CHALLENGE_MODEL` | No | Model used for challenge generation (default `qwen/qwen3-32b`) |
| `OTEL_ENABLED` | No | `true` to emit OpenTelemetry spans |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error` (default `info`) |

The process aborts at startup if `JWT_SECRET`, `AGENT_SHARED_SECRET`, or `GROQ_API_KEY` are absent or below minimum length.

---

## API Reference

### Authentication

```http
POST /api/auth/signup    { fullName, email, password }
POST /api/auth/login     { email, password }
POST /api/auth/refresh   { refreshToken }
POST /api/auth/logout
```

Responses include a JWT access token and an httpOnly refresh token cookie.

### Chat

```http
POST /message
{ "content": "...", "conversationId": "<id>", "agentId": "auto" }
```

`agentId`: `"auto"` for intelligent routing, or `"agent-1"` through `"agent-4"` to target directly.

```http
POST /plan-and-execute
{ "content": "...", "conversationId": "<id>" }
```

```http
POST /debate
{ "content": "...", "conversationId": "<id>" }
```

### Conversations

```http
GET    /api/conversations
GET    /api/conversations/:id
PUT    /api/conversations/:id
DELETE /api/conversations/:id
GET    /api/conversations/:id/export    # PDF
GET    /api/conversations/:id/usage     # token usage by model
```

### Prompt Versioning

```http
GET    /api/prompts
POST   /api/prompts            { agentId, systemPrompt, description }
POST   /api/prompts/:id/activate
DELETE /api/prompts/:id
```

### Monitoring

```http
GET /health     # status of MongoDB, Redis, agents, circuit breakers
GET /metrics    # Prometheus text format
```

### WebSocket Events (Socket.IO)

```javascript
const socket = io('http://localhost:3099', { auth: { token } });
socket.emit('join-conversation', conversationId);

// Standard message
socket.on('agent-thinking',  ({ agentId }) => {});
socket.on('stream-start',    ({ messageId, agentId }) => {});
socket.on('stream-token',    ({ token }) => {});
socket.on('stream-end',      ({ content, agentId, confidence }) => {});
socket.on('stream-error',    ({ agentId }) => {});

// Plan-and-execute
socket.on('planner-decomposing',   () => {});
socket.on('planner-plan-ready',    ({ tasks }) => {});
socket.on('planner-task-start',    ({ taskId, agentId }) => {});
socket.on('planner-task-complete', ({ taskId, contentPreview }) => {});
socket.on('planner-synthesizing',  () => {});
socket.on('planner-critic-done',   ({ score, approved }) => {});
```

---

## Project Structure

```
multi-agent-chatbot-system/
├── src/
│   ├── agents/
│   │   ├── manager/
│   │   │   ├── index.js             # Manager (Express + Socket.IO hub)
│   │   │   └── agentRouter.js       # HTTP dispatch, circuit breakers, dual-agent logic
│   │   ├── agent-llama3/index.js    # Agent 1 — general
│   │   ├── agent-mistral/index.js   # Agent 2 — analyst
│   │   ├── agent-phi3/index.js      # Agent 3 — creative
│   │   └── agent-qwen/index.js      # Agent 4 — specialist
│   │
│   ├── shared/
│   │   ├── agent-base.js            # BaseAgent class (all agents extend this)
│   │   ├── intentClassifier.js      # 3-tier routing: LLM → TF-IDF → keyword
│   │   ├── modelRouter.js           # routeModel / routeModelAsync / routeModelWithFallback
│   │   ├── plannerAgent.js          # Task decomposition, wave execution, synthesis
│   │   ├── debateEngine.js          # 4-phase debate cycle
│   │   ├── aggregator.js            # Dedup, conflict detection, LLM synthesis
│   │   ├── criticAgent.js           # Quality critique and optional revision pass
│   │   ├── voting.js                # Voting strategies for team conversations
│   │   ├── memory.js                # Per-user MongoDB memory (AgentMemory)
│   │   ├── sharedMemory.js          # Global + per-agent memory broker
│   │   ├── circuitBreaker.js        # CLOSED / OPEN / HALF_OPEN per agent
│   │   ├── retry.js                 # Exponential backoff with full jitter
│   │   ├── agentAuth.js             # HMAC-SHA256 sign / verify
│   │   ├── moderation.js            # Content filtering
│   │   ├── ollama.js                # Groq API wrapper
│   │   ├── messaging.js             # FIPA-ACL message format
│   │   ├── summarizer.js            # Long-history summarisation
│   │   ├── agent-config.js          # Per-agent config and prompt versioning
│   │   ├── llmTracer.js             # JSONL trace per LLM call
│   │   ├── tracing.js               # OpenTelemetry instrumentation
│   │   └── logger.js                # Structured Winston logging
│   │
│   ├── middleware/
│   │   ├── auth.js                  # JWT verification
│   │   ├── rateLimiter.js           # Redis-backed rate limiters (5 tiers)
│   │   └── auditLog.js              # Append-only auth event log
│   │
│   ├── models/
│   │   ├── User.js
│   │   ├── Conversation.js
│   │   ├── Memory.js
│   │   └── PromptVersion.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── conversations.js
│   │   ├── prompts.js
│   │   └── agentConfigs.js
│   │
│   ├── monitoring/
│   │   └── metrics.js               # Prometheus counters, histograms, circuit state gauges
│   │
│   └── config/
│       ├── database.js
│       └── redis.js
│
├── multi-agent-chatbot/              # Next.js frontend
│   └── app/
│       ├── chat/page.tsx
│       ├── dashboard/page.tsx
│       ├── login/page.tsx
│       └── signup/page.tsx
│
├── tests/
├── docs/
└── package.json
```

---

## Testing

```bash
npm run test:unit       # Jest unit tests — all external deps mocked
npm run test:e2e        # Supertest integration tests (auth, conversations, health)
npm run eval            # LLM-as-judge eval harness → logs/eval-report.jsonl
```

### Coverage areas

| Module | What is tested |
|---|---|
| `intentClassifier` | All 3 tiers, cache behavior, NaN safety, secondCandidate |
| `modelRouter` | Sync and async routing, fallback logic, confidence guard |
| `aggregator` | Deduplication, conflict detection, LLM failure fallback, empty output safety |
| `criticAgent` | Approve path, reject + revise path, LLM failure auto-approve |
| `plannerAgent` | Wave ordering, dependency injection, immutability, circular dependency handling |
| `circuitBreaker` | All state transitions, recovery timing |
| `agentAuth` | Sign/verify round-trip, tamper detection |
| `retry` | Backoff intervals, exhaustion, retryable error codes |

---

## Security

| Control | Implementation |
|---|---|
| **JWT authentication** | HS256, httpOnly cookie + Bearer header |
| **Agent request signing** | HMAC-SHA256 over raw request body, verified before processing |
| **Rate limiting** | Redis-backed: 5/15m (auth), 30/min (messages), 5/hr (exports) |
| **CSRF protection** | Origin header validated against `FRONTEND_URL` on all mutating requests |
| **Security headers** | Helmet: CSP, HSTS, X-Frame-Options, referrer policy |
| **Input validation** | Validated at all external boundaries; HTML-escaped before rendering |
| **Password hashing** | bcrypt, cost factor 10 |
| **Audit logging** | Auth events written to `logs/audit.log` with IP and user agent |
| **Secret validation** | Process exits at startup if required secrets are absent or too short |
| **XSS prevention** | `escapeHtml()` applied to all user-generated content before output |

---

## Extending the System

### Add a new agent

1. Copy `src/agents/agent-llama3/` → `src/agents/agent-{name}/`
2. Set a model and personality in the constructor
3. Add the port to `.env`
4. Register the endpoint in `AGENT_ENDPOINTS` in `src/agents/manager/agentRouter.js`
5. Add routing keywords to `AGENT_PROFILES` in `src/shared/intentClassifier.js`

### Swap a model

Set `AGENT_{N}_MODEL=<groq-model-id>` in `.env`. No code changes needed.

### Adjust routing confidence

```env
# Lower value = more dual-agent consultations
LOW_CONFIDENCE_THRESHOLD=0.5
```

Or edit the constant in `src/shared/modelRouter.js:93`.

### Disable the critic pass

Comment out the `criticPass` call in `src/shared/plannerAgent.js` inside the `plan()` method.

---

## License

[MIT](LICENSE)
