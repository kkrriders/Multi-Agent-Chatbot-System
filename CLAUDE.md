# MockPrep — Claude Code Project Guide

## What this project is

AI mock interview platform. Candidates upload a CV, pick a role and mode, answer AI-generated questions via text or voice, get real-time scored feedback, and track progress over time. Backend is Node.js/Express. Frontend is Next.js 15 (TypeScript) in `frontend/`.

---

## Architecture at a glance

```
server.js                        ← single Express entry point (port 3000)
  └── src/
      ├── routes/                ← thin HTTP handlers only, no business logic
      │   ├── auth.js
      │   ├── cv.js              ← /api/cv/*
      │   ├── interview.js       ← /api/interview/*
      │   ├── progress.js        ← /api/progress/*
      │   └── questions.js       ← /api/questions/*
      ├── services/              ← all business logic lives here
      │   ├── ai/
      │   │   ├── provider-manager.js     ← ALL AI calls go through here
      │   │   └── providers/             ← groq-provider.js, openrouter-provider.js
      │   ├── cv/                ← cv-parser, skill-extractor, gap-analyzer
      │   ├── interview/         ← question-generator, answer-scorer, session-manager
      │   ├── speech/            ← filler-detector (no AI — pure text analysis)
      │   ├── gamification/      ← achievement-service (badges, streaks, leaderboard)
      │   ├── history/           ← observation-compiler, retrieval-service
      │   └── sse/               ← broadcaster (real-time events to browser)
      ├── models/                ← Mongoose schemas
      │   ├── User.js, Interview.js, Question.js, Answer.js
      │   ├── CandidateProfile.js, Observation.js, Achievement.js
      ├── middleware/
      │   ├── auth.js            ← JWT verification
      │   ├── rateLimiter.js     ← Redis-backed, in-memory fallback
      │   ├── auditLog.js        ← security audit trail
      │   └── injection-guard.js ← prompt injection scanner for CV/JD inputs
      ├── shared/
      │   ├── logger.js          ← Winston logger
      │   ├── retry.js           ← exponential backoff with full jitter
      │   ├── circuitBreaker.js  ← fault tolerance for external calls
      │   └── summarizer.js      ← conversation summarisation via AI
      ├── config/
      │   ├── database.js        ← MongoDB connection
      │   └── redis.js           ← Redis client
      └── utils/
          ├── jwt.js, tokenBlacklist.js, validateEnv.js

frontend/                        ← Next.js 15, TypeScript (port 3002)
  ├── app/                       ← App Router pages
  │   ├── page.tsx               ← landing
  │   ├── dashboard/, upload/    ← post-auth pages
  │   ├── interview/             ← setup + [sessionId] active interview
  │   ├── results/[sessionId]/   ← post-interview summary
  │   ├── progress/, leaderboard/, questions/
  ├── hooks/
  │   ├── useSSE.ts              ← SSE connection with auto-reconnect
  │   └── useSpeech.ts           ← Web Speech API
  └── lib/api.ts                 ← typed API client for all backend routes
```

---

## Critical rules — read before touching any file

### AI calls
- **ALWAYS** call AI through `src/services/ai/provider-manager.js` — never import `groq-sdk` directly anywhere else
- Use the right tier: `fast` for scoring (llama-3.1-8b), `balanced` for question generation (llama-3.3-70b), `quality` for gap analysis (qwen3-32b)
- **NEVER** fire parallel Groq calls — Groq free tier is 30 req/min shared across all users. Sequential calls only.
- `qwen3-32b` has a 6,000 tokens/min limit — use `quality` tier sparingly, never in tight loops

### Security
- **ALL** CV text, JD text, and any user-supplied text going into AI prompts MUST pass through `injection-guard.assertSafe()` or the `guard()` middleware first
- JWT is required on every interview/cv/progress/questions route — check `authenticate` is in the middleware chain
- Rate limiter must be applied on every route — use `generalLimiter` or `messageLimiter` from `rateLimiter.js`

### Real-time events
- Use `src/services/sse/broadcaster.js` for server → browser push events
- Do NOT use Socket.IO for new MockPrep features — it exists for legacy reasons only
- SSE event names: `scoring-start`, `score-update`, `scoring-error`, `speech-event`, `timer-tick`, `session-ended`

### Immutability
- Never mutate objects in place — always return new objects
- MongoDB updates: use `findByIdAndUpdate()` with explicit fields, never `doc.field = x; doc.save()` unless building a new document

### File size
- Routes: max 200 lines. If a route handler is doing business logic, move it to a service.
- Services: max 300 lines. Split by single responsibility.
- No file over 400 lines — extract utilities.

---

## Models quick reference

| Model | Key fields | Common queries |
|---|---|---|
| `Interview` | userId, mode, status, questionIds, overallScore, categoryScores | `{userId, status: 'active'}` |
| `Question` | text, category, role, difficulty, expectedKeywords, source | `{category, role, active: true}` |
| `Answer` | interviewId, questionId, userId, text, scores, speechMetrics | `{interviewId}` |
| `CandidateProfile` | userId (unique), skills, experience, cvText, skillGaps | `{userId}` — one per user |
| `Observation` | userId, interviewId, type, concept, score, summary | `{userId, type}`, `{userId, concept}` |
| `Achievement` | userId, type (unique per user), awardedAt | `{userId}` |

Observation types: `speech_quality`, `technical_accuracy`, `cv_gap`, `weak_area`, `strong_area`

---

## 3-layer history retrieval pattern

This is the core of progress tracking. Always use `retrieval-service.js`, never query Observation directly in routes.

```
Layer 1 — search(userId, filter)      → compact index (~50 tokens each), use to find IDs
Layer 2 — timeline(userId)            → chronological session groups, use for charts
Layer 3 — detail(ids)                 → full data, only load what Layer 1 identified
```

---

## AI model tiers

| Tier | Groq model | When to use |
|---|---|---|
| `fast` | `llama-3.1-8b-instant` | Scoring, any repeated per-answer call |
| `balanced` | `llama-3.3-70b-versatile` | Question generation, skill extraction |
| `quality` | `qwen/qwen3-32b` | Gap analysis, session feedback — use sparingly |

---

## Groq rate limits (free tier)

| Model | Req/min | Tokens/min | Req/day |
|---|---|---|---|
| llama-3.1-8b-instant | 30 | 131,072 | 14,400 |
| llama-3.3-70b-versatile | 30 | 131,072 | 1,000 |
| qwen/qwen3-32b | 30 | **6,000** | 1,000 |

If quota is exhausted, `provider-manager.js` automatically falls back to OpenRouter. Never add manual fallback logic elsewhere.

---

## Interview session flow

```
POST /api/interview/start
  → question-generator.generate()  [1-3 Groq calls, quality tier]
  → Interview + Questions saved to MongoDB

POST /api/interview/:id/answer
  → Answer saved immediately (HTTP responds fast)
  → setImmediate: scorer.score() [1 Groq call, fast tier]
  → broadcaster.emit('score-update') via SSE

POST /api/interview/:id/complete
  → scorer.aggregate() [no AI call — pure math]
  → achievement checks [no AI — MongoDB queries]
  → broadcaster.close(sessionId)
```

---

## Testing

- Unit tests: `tests/unit/` — test services and utilities in isolation
- E2E tests: `tests/e2e/` — test HTTP endpoints with `supertest`
- Run: `npm test` | `npm run test:unit` | `npm run test:e2e`
- Coverage target: 80% for services, 100% for middleware

**TDD rule:** Write the test first. Run it — it must fail. Then implement. Never write production code before a failing test exists.

---

## Common commands

```bash
npm start                         # backend on :3000
npm run dev                       # backend with --watch
cd frontend && npm run dev        # frontend on :3002
npm test                          # all tests
node -e "require('./server.js')"  # verify imports resolve
```

---

## What is planned but not yet built

- **Panel interview mode** — 3 AI personas (technical, behavioural, bar raiser) asking different question types, end-of-session parallel feedback
- **Adaptive follow-up** — decision agent between questions: follow_up / probe_deeper / next / challenge
- **Code execution sandbox** — run candidate code for coding questions (Judge0 / Piston)
- **Company-specific research agent** — searches company interview patterns before session
- **BullMQ scoring queue** — replace `setImmediate` with proper job queue for rate-limit-safe concurrent scoring
- **Whisper STT fallback** — server-side transcription for browsers without Web Speech API support
- **Frontend pages need content** — `frontend/app/` has the scaffold but pages need to be populated (moved from `multi-agent-chatbot/`)

---

## What NOT to do

- Do not import `groq-sdk` directly — use `provider-manager.js`
- Do not add `socket.io` events for new features — use SSE
- Do not fire multiple Groq calls in `Promise.all()` — sequential only on free tier
- Do not add 4 separate agent processes — the old multi-agent chatbot pattern was removed intentionally
- Do not store CV text in logs or SSE events — it's PII
- Do not skip the injection guard on user-supplied text going to AI
- Do not add back `Conversation.js`, `Memory.js`, `PromptVersion.js` models — they were removed
- Do not use `pdfkit` for anything new — it was removed from dependencies
- Do not use `socket.io-client` in frontend — use the native `EventSource` API via `useSSE.ts`
