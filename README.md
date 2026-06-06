# MockPrep — AI Mock Interview Platform

Upload your CV, pick a role and company, and practice with AI-generated questions tailored to your background. Get real-time scoring, speech analysis, adaptive follow-ups, and personalised feedback across sessions. Supports text/voice interviews, system design canvas, and DSA coding challenges.

---

## Features

| # | Feature | Status |
|---|---|---|
| 1 | CV/Resume Upload & Parsing (PDF/DOCX/TXT) | ✅ |
| 2 | AI Question Generation from CV + JD | ✅ |
| 3 | Answer Submission — text or voice | ✅ |
| 4 | Real-time Scoring — relevance, depth, clarity (0–100) | ✅ |
| 5 | Session Summary Report | ✅ |
| 6 | Speech-to-Text — Web Speech API + Groq Whisper fallback | ✅ |
| 7 | Filler Word Detection (um, uh, like…) | ✅ |
| 8 | Pronunciation Confidence Score | ✅ |
| 9 | CV Gap Analysis vs Job Description | ✅ |
| 10 | Weak Area Detection across sessions | ✅ |
| 11 | Per-answer Improvement Suggestions | ✅ |
| 12 | Progress Tracking (3-layer history) | ✅ |
| 13 | Practice Mode | ✅ |
| 14 | Timed Interview Mode | ✅ |
| 15 | Full Mock Interview (intro → technical → behavioral → closing) | ✅ |
| 16 | Panel Interview Mode (Alex / Priya / James personas) | ✅ |
| 17 | Adaptive Follow-up (follow up / probe / challenge / next) | ✅ |
| 18 | Company Research Agent (Tavily + curated JSON) | ✅ |
| 19 | BullMQ Scoring Queue (rate-limit-safe concurrent scoring) | ✅ |
| 20 | Daily Practice Streaks + Achievement Badges | ✅ |
| 21 | Question Randomisation — `$sample` — different questions every session | ✅ |
| 22 | Question Deduplication — never repeat an already-answered question | ✅ |
| 23 | CV Required Gate — interview blocked until CV is uploaded | ✅ |
| 24 | System Design Canvas — React Flow with 14 node types | ✅ |
| 25 | System Design Questions — blank / fix broken design / improve design | ✅ |
| 26 | System Design AI Scorer — evaluates diagram + written explanation | ✅ |
| 27 | CS Fundamentals Questions — OS, Networking, Databases, Algorithms | ✅ |
| 28 | DSA Coding Questions — Monaco editor, 8 languages | ✅ |
| 29 | Code Execution — Piston API, test case pass/fail via SSE | ✅ |
| 30 | Question Bank Management (admin) | ✅ |

---

## Tech Stack

**Backend**
- Node.js + Express — single process, port 3000
- MongoDB (Mongoose) — interviews, answers, profiles, observations, achievements
- Redis — BullMQ scoring queue + rate limiting (in-memory fallback when absent)
- Groq API — LLM (llama-3.1-8b / llama-3.3-70b / qwen3-32b) + Whisper STT
- OpenRouter — automatic fallback when Groq quota is exhausted
- Tavily — optional live company research (falls back to curated JSON)
- Piston API — free code execution for DSA questions (no key needed)
- SSE (Server-Sent Events) — real-time score, speech, and test result events

**Frontend**
- Next.js 15 (App Router, TypeScript), port 3002 — React 19
- Tailwind CSS v4 + Radix UI primitives
- React Flow (`@xyflow/react`) — system design canvas
- Monaco Editor (`@monaco-editor/react`) — DSA code editor
- Recharts — progress trend charts
- Zod + React Hook Form — client-side validation
- Web Speech API + MediaRecorder — browser-side STT with Whisper fallback

---

## Project Structure

```
mockprep/
├── server.js                      ← Express entry point (port 3000)
├── src/
│   ├── routes/                    ← Thin HTTP handlers only
│   │   ├── auth.js                ← /api/auth/*
│   │   ├── cv.js                  ← /api/cv/*
│   │   ├── interview.js           ← /api/interview/*
│   │   ├── progress.js            ← /api/progress/*
│   │   ├── questions.js           ← /api/questions/*
│   │   └── speech.js              ← /api/speech/transcribe
│   ├── services/
│   │   ├── ai/                    ← provider-manager (Groq → OpenRouter)
│   │   ├── agents/                ← orchestrator, profile-agent, research-agent
│   │   ├── cv/                    ← cv-parser, skill-extractor, gap-analyzer
│   │   ├── interview/             ← question-generator, answer-scorer,
│   │   │                             session-manager, decision-agent,
│   │   │                             panel-interviewer, session-feedback,
│   │   │                             system-design-scorer, code-executor
│   │   ├── queue/                 ← scoring-queue (BullMQ + setImmediate fallback)
│   │   ├── speech/                ← filler-detector, whisper-transcriber
│   │   ├── history/               ← observation-compiler, retrieval-service
│   │   ├── sse/                   ← broadcaster
│   │   └── gamification/          ← achievement-service
│   ├── models/                    ← Mongoose schemas
│   ├── middleware/                 ← auth, rateLimiter, injection-guard, auditLog
│   ├── data/
│   │   ├── companies/             ← 15 curated company interview profiles
│   │   └── seed-questions.js      ← CS Fundamentals + System Design + DSA seed
│   └── shared/                    ← logger, retry, circuitBreaker
├── frontend/                      ← Next.js 15 (port 3002)
│   ├── app/                       ← App Router pages
│   │   ├── interview/             ← setup + [sessionId] active interview
│   │   └── ...                    ← dashboard, upload, progress, results, etc.
│   ├── components/
│   │   ├── SystemDesignCanvas.tsx ← React Flow canvas + 14 node types
│   │   └── CodeEditor.tsx         ← Monaco editor + test result panel
│   ├── hooks/                     ← useSSE, useSpeech (+ Whisper fallback), useRequireAuth
│   └── lib/                       ← api.ts, auth.ts, config.ts
├── tests/
│   ├── unit/                      ← services + middleware (68 tests)
│   └── e2e/                       ← HTTP endpoint tests (supertest)
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### 1. Clone and install

```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Minimum required:
```env
JWT_SECRET=<48-char hex>
MONGODB_URI=mongodb://localhost:27017/mockprep
GROQ_API_KEY=gsk_...
FRONTEND_URL=http://localhost:3002
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Seed the question bank

Run once after connecting to MongoDB to populate CS Fundamentals, System Design templates, and DSA coding questions:

```bash
npm run seed
```

### 4. Run locally

```bash
# Backend (port 3000)
npm run dev

# Frontend (port 3002) — separate terminal
cd frontend && npm run dev
```

### 5. Or run with Docker

```bash
docker compose up --build
```

Starts MongoDB, Redis, backend, and frontend. No local Node.js needed.

---

## API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, sets JWT cookie |
| POST | `/api/auth/logout` | Clear session |
| GET  | `/api/auth/me` | Current user |

### CV
| Method | Path | Description |
|---|---|---|
| POST | `/api/cv/upload` | Upload CV (PDF/DOCX/TXT), extract skills |
| GET  | `/api/cv/profile` | Fetch candidate profile |
| POST | `/api/cv/analyze-gap` | Compare CV to a job description |

### Interview
| Method | Path | Description |
|---|---|---|
| POST | `/api/interview/start` | Create session — requires CV on file |
| GET  | `/api/interview/stream/:sessionId` | SSE stream — scores, test results, speech events |
| GET  | `/api/interview/:sessionId` | Session state + questions (with format fields) |
| POST | `/api/interview/:sessionId/answer` | Submit text / diagram / code answer |
| POST | `/api/interview/:sessionId/complete` | Finalise + compute summary |
| GET  | `/api/interview/:sessionId/summary` | Full results |
| GET  | `/api/interview/history` | Past sessions |

`POST /start` returns `{ error: 'cv_required' }` (HTTP 400) if no CV has been uploaded.

Answer submission accepts:
```json
{
  "questionId": "...",
  "answerText": "...",
  "diagramSnapshot": "{ nodes: [], edges: [] }",
  "code": "function twoSum(...) {}",
  "language": "javascript"
}
```

### Speech
| Method | Path | Description |
|---|---|---|
| POST | `/api/speech/transcribe` | Transcribe audio blob via Groq Whisper (multipart/form-data, field: `audio`) |

### Progress
| Method | Path | Description |
|---|---|---|
| GET | `/api/progress/summary` | Weak/strong areas, avg score |
| GET | `/api/progress/timeline` | Session timeline for charts |
| GET | `/api/progress/trend/:concept` | Score trend for a concept |
| GET | `/api/progress/streak` | Current daily streak |
| GET | `/api/progress/achievements` | Earned badges |
| GET | `/api/progress/leaderboard` | Personal session ranking |

### Questions
| Method | Path | Description |
|---|---|---|
| GET    | `/api/questions` | List (filter: `role`, `category`, `difficulty`) |
| POST   | `/api/questions` | Create (admin) |
| PUT    | `/api/questions/:id` | Update (admin) |
| DELETE | `/api/questions/:id` | Deactivate (admin) |
| POST   | `/api/questions/from-jd` | Generate from a job description |

---

## Interview Modes

| Mode | Questions | Time | Notes |
|---|---|---|---|
| `practice` | 10 | None | Adaptive follow-ups, skip allowed |
| `timed` | 10 | Per-question (2 min) | Auto-submits on expiry, no follow-ups |
| `full` | 14 | None | intro → technical → behavioral → situational → closing |
| `panel` | 12 | None | Alex (tech), Priya (behavioural), James (bar raiser) + end-of-session panel feedback |

Pass `companyName` to any mode to tailor questions to that company's interview style via the research agent.

---

## Question Formats

### Text / Voice
Standard Q&A. Scored on relevance, depth, and clarity by the AI scorer. Decision agent decides whether to follow up, probe deeper, challenge, or move on.

### System Design (`questionFormat: 'system_design'`)
Three subtypes:
- **blank** — empty canvas, design from scratch
- **fix** — broken template pre-loaded, identify and fix problems
- **improve** — working design pre-loaded, suggest optimisations

User draws on a React Flow canvas (14 component types) and writes a text explanation. AI scorer evaluates diagram completeness against a rubric + text quality.

### Coding / DSA (`questionFormat: 'coding'`)
Monaco editor with 8 language options. Code is executed against test cases via the Piston API. Visible test cases show input/expected/actual; hidden test cases show only pass/fail. Results arrive via SSE in real time.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Signing secret (48+ char random hex) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GROQ_API_KEY` | Yes | Primary LLM + Whisper STT (free at console.groq.com) |
| `FRONTEND_URL` | Yes | CORS origin — e.g. `http://localhost:3002` |
| `OPENROUTER_API_KEY` | No | LLM fallback when Groq quota exhausted |
| `REDIS_URL` | No | BullMQ queue + rate limiting (in-memory fallback if absent) |
| `TAVILY_API_KEY` | No | Live company research (1,000 free searches/month) |
| `PORT` | No | Default: 3000 |
| `LOG_LEVEL` | No | `error` \| `warn` \| `info` \| `debug` — default: `info` |

---

## Dev Commands

```bash
# Backend
npm run dev              # start with --watch
npm run seed             # seed question bank (run once after first deploy)
npm test                 # all tests (Jest)
npm run test:unit        # unit tests only
npm run test:e2e         # e2e tests only (supertest)
npm run test:coverage    # test + coverage report
npm run lint             # ESLint
npm run lint:fix         # ESLint + auto-fix
npm run format           # Prettier write
npm run format:check     # Prettier check (CI)

# Frontend
cd frontend
npm run dev              # Next.js dev server (port 3002)
npm run build            # production build
npm run lint             # Next.js ESLint
npm run type-check       # tsc --noEmit
```

---

## Known Gaps / Next Steps

- **More question content** — additional system design templates (Twitter, Uber, YouTube) and harder DSA problems (LRU Cache, Course Schedule, Word Break)
- **Results page** — display `diagramSnapshot` in read-only canvas and `testResults` for completed coding answers
- **Admin role guard** — question CRUD currently requires only `isAdmin` flag; no admin UI yet
- **Email verification / password reset** — auth works but no email flow
- **Adaptive difficulty** — bump question difficulty after 3 consecutive high scores
- **frontend/Dockerfile** — needed for `docker compose up`; Next.js standalone output recommended
