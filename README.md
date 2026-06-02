# MockPrep — AI Mock Interview Platform

> GitHub: [kkrriders/MockPrep](https://github.com/kkrriders/MockPrep)

Upload your CV, pick a role and company, and practice with AI-generated questions tailored to your background. Get real-time scoring, speech analysis, adaptive follow-ups, and personalised feedback across sessions.

---

## Features

| # | Feature | Status |
|---|---|---|
| 1 | CV/Resume Upload & Parsing (PDF/DOCX/TXT) | ✅ |
| 2 | AI Question Generation (CV + JD) | ✅ |
| 3 | Answer Submission — text or voice | ✅ |
| 4 | Real-time Scoring — relevance, depth, clarity (0–100) | ✅ |
| 5 | Session Summary Report | ✅ |
| 6 | Speech-to-Text (Web Speech API) | ✅ |
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
| 18 | Company Research Agent (tailors questions to target company + CV) | ✅ |
| 19 | BullMQ Scoring Queue (rate-limit-safe concurrent scoring) | ✅ |
| 20 | Daily Practice Streaks | ✅ |
| 21 | Achievement Badges (10 types) | ✅ |
| 22 | Personal Session Leaderboard | ✅ |
| 23 | Question Bank Management | ✅ |
| 24 | Job Description Input (tailors questions) | ✅ |

---

## Tech Stack

**Backend**
- Node.js + Express — single process, port 3000
- MongoDB (Mongoose) — interviews, answers, profiles, observations, achievements
- Redis — BullMQ scoring queue + rate limiting
- Groq API — primary LLM (llama-3.1-8b / llama-3.3-70b / qwen3-32b)
- OpenRouter — automatic fallback when Groq quota is exhausted
- Tavily — optional live company research (falls back to curated JSON)
- SSE (Server-Sent Events) — real-time score and speech events

**Frontend**
- Next.js 15 (App Router, TypeScript), port 3002 — React 19
- Tailwind CSS v4 + Radix UI primitives
- Recharts — progress trend charts
- Zod + React Hook Form — client-side validation
- next-themes — dark/light mode
- Web Speech API — browser-side speech-to-text

---

## Project Structure

```
mockprep/
├── server.js                    ← Express entry point
├── src/
│   ├── routes/                  ← Thin HTTP handlers only
│   │   ├── auth.js              ← /api/auth/*
│   │   ├── cv.js                ← /api/cv/*
│   │   ├── interview.js         ← /api/interview/*
│   │   ├── progress.js          ← /api/progress/*
│   │   └── questions.js         ← /api/questions/*
│   ├── services/
│   │   ├── ai/                  ← provider-manager.js (Groq → OpenRouter)
│   │   ├── agents/              ← orchestrator, profile-agent, research-agent
│   │   ├── cv/                  ← cv-parser, skill-extractor, gap-analyzer
│   │   ├── interview/           ← question-generator, answer-scorer, session-manager
│   │   │                           decision-agent, panel-interviewer, session-feedback
│   │   ├── queue/               ← scoring-queue (BullMQ)
│   │   ├── speech/              ← filler-detector
│   │   ├── history/             ← observation-compiler, retrieval-service
│   │   ├── sse/                 ← broadcaster
│   │   └── gamification/        ← achievement-service
│   ├── models/                  ← Mongoose schemas
│   ├── middleware/              ← auth, rateLimiter, injection-guard, auditLog
│   ├── data/companies/          ← 15 curated company interview profiles
│   └── shared/                  ← logger, retry, circuitBreaker
├── frontend/                    ← Next.js 15 app (port 3002)
│   ├── app/                     ← App Router pages
│   ├── hooks/                   ← useSSE, useSpeech, useRequireAuth
│   ├── lib/                     ← api.ts, auth.ts, config.ts
│   └── components/              ← nav, theme-provider, ui/
├── Dockerfile                   ← Backend image (multi-stage, non-root)
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

Minimum required in `.env`:
```env
JWT_SECRET=<48-char hex>
MONGODB_URI=mongodb://localhost:27017/mockprep
GROQ_API_KEY=gsk_...
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. (Optional) Generate `.env` interactively

```bash
npm run setup
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

Starts MongoDB, Redis, backend API, and frontend. No local Node.js needed.

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
| POST | `/api/interview/start` | Create session — accepts `mode`, `targetRole`, `jobDescription`, `companyName` |
| GET  | `/api/interview/stream/:sessionId` | SSE stream — live score and speech events |
| GET  | `/api/interview/:sessionId` | Session state |
| POST | `/api/interview/:sessionId/answer` | Submit answer (async scoring via BullMQ) |
| POST | `/api/interview/:sessionId/complete` | Finalise session, compute summary |
| GET  | `/api/interview/:sessionId/summary` | Full results |
| GET  | `/api/interview/history` | Past sessions |

`POST /start` response includes `companyResearch: { source, confidence }` when a company name is provided — values are `curated`, `curated+live`, `live`, or `none`.

### Progress
| Method | Path | Description |
|---|---|---|
| GET | `/api/progress/summary` | Weak/strong areas, avg score |
| GET | `/api/progress/timeline` | Session timeline |
| GET | `/api/progress/trend/:concept` | Score trend for a topic |
| GET | `/api/progress/streak` | Current daily streak |
| GET | `/api/progress/achievements` | Earned badges |
| GET | `/api/progress/leaderboard` | Personal session ranking |

### Questions
| Method | Path | Description |
|---|---|---|
| GET    | `/api/questions` | List (filter by role/category/difficulty) |
| POST   | `/api/questions` | Create question |
| PUT    | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Deactivate question |
| POST   | `/api/questions/from-jd` | Generate questions from a job description |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing secret (48+ char random hex) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GROQ_API_KEY` | Yes | Primary LLM provider (free at console.groq.com) |
| `FRONTEND_URL` | Yes | CORS origin — default `http://localhost:3002` |
| `OPENROUTER_API_KEY` | No | Fallback LLM when Groq quota is exhausted |
| `REDIS_URL` | No | Redis for BullMQ queue + rate limiting (in-memory fallback) |
| `TAVILY_API_KEY` | No | Live company research (1,000 free searches/month at tavily.com) |
| `PORT` | No | Default: 3000 |
| `LOG_LEVEL` | No | `error` \| `warn` \| `info` \| `debug` — default: `info` |

---

## Interview Modes

| Mode | Description |
|---|---|
| `practice` | 10 questions, no time limit, adaptive follow-ups |
| `timed` | 10 questions, per-question timer, auto-submit on expiry |
| `full` | 14 questions: intro → technical → behavioral → situational → closing |
| `panel` | 12 questions from 3 personas: Alex (technical), Priya (behavioural), James (bar raiser) |

Pass `companyName` to any mode to tailor questions to that company's interview style.

---

## Dev Commands

```bash
# Backend
npm run dev              # start with --watch
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

- **Whisper STT fallback** — currently browser-only Web Speech API; add server-side fallback in `src/services/speech/`
- **Admin role guard** — question CRUD is open to all authenticated users; add `isAdmin` to `User.js`
- **Email verification / password reset** — auth works but no email flow
- **Next.js route middleware** — add `frontend/middleware.ts` for server-level auth guard
- **Adaptive difficulty** — bump question difficulty after 3 consecutive high scores
- **Code execution sandbox** — run candidate code via Judge0/Piston for coding questions
- **frontend/Dockerfile** — needed for `docker compose up`; Next.js standalone output recommended
