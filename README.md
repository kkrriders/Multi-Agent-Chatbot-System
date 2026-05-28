# MockPrep — AI Mock Interview Platform

A full-stack mock interview platform built on Node.js/Express and Next.js. Upload your CV, pick a role, and practice with AI-generated questions, live scoring, speech analysis, and personalised feedback.

---

## Features

| # | Feature | Status |
|---|---|---|
| 1 | CV/Resume Upload & Parsing | ✅ |
| 2 | AI Question Generation (from CV + JD) | ✅ |
| 3 | Answer Submission (text or voice) | ✅ |
| 4 | Real-time Scoring — relevance, depth, clarity (0–100) | ✅ |
| 5 | Session Summary Report | ✅ |
| 6 | Speech-to-Text (Web Speech API) | ✅ |
| 7 | Filler Word Detection (um, uh, like…) | ✅ |
| 8 | Pronunciation Confidence Score | ✅ |
| 9 | CV Gap Analysis vs Job Description | ✅ |
| 10 | Weak Area Detection | ✅ |
| 11 | Per-answer Improvement Suggestions | ✅ |
| 12 | Progress Tracking across sessions | ✅ |
| 13 | Practice Mode (unlimited time) | ✅ |
| 14 | Timed Interview Mode | ✅ |
| 15 | Full Mock Interview (intro → technical → behavioral → closing) | ✅ |
| 16 | Personal Session Leaderboard | ✅ |
| 17 | Daily Practice Streaks | ✅ |
| 18 | Achievement Badges (10 types) | ✅ |
| 19 | Question Bank Management (admin CRUD) | ✅ |
| 20 | Job Description Input (tailors questions) | ✅ |

---

## Tech Stack

**Backend**
- Node.js + Express
- MongoDB (Mongoose) — users, interviews, answers, observations, achievements
- Redis — rate limiting, session cache
- Groq API — primary LLM provider (free tier)
- OpenRouter — fallback AI provider on quota exhaustion
- Socket.IO — existing WebSocket layer
- SSE (Server-Sent Events) — live score/speech events during interview

**Frontend**
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS + Radix UI components
- Recharts — progress trend charts
- Sonner — toast notifications
- Web Speech API — browser-side speech-to-text

---

## Project Structure

```
Mockprep/
├── src/
│   ├── agents/
│   │   └── manager/index.js     # Main Express app — all routes registered here
│   ├── models/
│   │   ├── Interview.js
│   │   ├── Question.js
│   │   ├── Answer.js
│   │   ├── CandidateProfile.js
│   │   ├── Observation.js
│   │   └── Achievement.js
│   ├── routes/
│   │   ├── cv.js                # /api/cv/*
│   │   ├── interview.js         # /api/interview/*
│   │   ├── progress.js          # /api/progress/*
│   │   └── questions.js         # /api/questions/*
│   ├── services/
│   │   ├── ai/                  # Multi-provider AI (Groq → OpenRouter fallback)
│   │   ├── cv/                  # CV parsing, skill extraction, gap analysis
│   │   ├── history/             # 3-layer observation/progress system
│   │   ├── interview/           # Question generation, answer scoring, session management
│   │   ├── speech/              # Filler word detection, pronunciation scoring
│   │   ├── sse/                 # Real-time SSE broadcaster
│   │   └── gamification/        # Badges, streaks, leaderboard
│   └── middleware/
│       └── injection-guard.js   # Prompt injection protection on CV/JD inputs
│
├── multi-agent-chatbot/         # Next.js frontend
│   ├── app/
│   │   ├── page.tsx             # Landing
│   │   ├── login/ & signup/     # Auth pages
│   │   ├── dashboard/           # Home after login
│   │   ├── upload/              # CV upload + gap analysis
│   │   ├── interview/           # Setup page
│   │   ├── interview/[sessionId]/ # Active interview (live scoring + voice)
│   │   ├── results/[sessionId]/ # Session results + per-answer breakdown
│   │   ├── progress/            # Progress charts and trends
│   │   ├── leaderboard/         # Badges + personal rankings
│   │   └── questions/           # Question bank admin
│   ├── hooks/
│   │   ├── useSSE.ts            # SSE connection with auto-reconnect
│   │   └── useSpeech.ts         # Web Speech API hook
│   ├── lib/
│   │   └── api.ts               # Typed API client for all backend routes
│   └── components/
│       └── nav.tsx              # Top navigation bar
│
├── MOCKPREP_BUILD_SUMMARY.md    # Detailed build notes from this session
└── .env.example
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` — minimum required:
```env
JWT_SECRET=<random 48-char hex>
AGENT_SHARED_SECRET=<random 48-char hex>
MONGODB_URI=mongodb://localhost:27017/mockprep
GROQ_API_KEY=gsk_...          # free at console.groq.com

# Optional: AI fallback if Groq quota runs out
OPENROUTER_API_KEY=            # free at openrouter.ai
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Start backend
```bash
npm start
```

### 4. Start frontend
```bash
cd multi-agent-chatbot
npm install
npm run dev
```

Frontend: **http://localhost:3002**  
Backend API: **http://localhost:3000**

---

## API Routes

### CV
| Method | Path | Description |
|---|---|---|
| POST | `/api/cv/upload` | Upload CV (PDF/DOCX/TXT), extract skills |
| GET | `/api/cv/profile` | Fetch current candidate profile |
| POST | `/api/cv/analyze-gap` | Compare CV skills to a job description |

### Interview
| Method | Path | Description |
|---|---|---|
| POST | `/api/interview/start` | Create session, generate questions |
| GET | `/api/interview/stream/:sessionId` | SSE stream — live score/speech events |
| GET | `/api/interview/:sessionId` | Session state |
| POST | `/api/interview/:sessionId/answer` | Submit answer (triggers async scoring) |
| POST | `/api/interview/:sessionId/complete` | Finalise session, compute summary |
| GET | `/api/interview/:sessionId/summary` | Full results with insights |
| GET | `/api/interview/history` | All past sessions |

### Progress
| Method | Path | Description |
|---|---|---|
| GET | `/api/progress/summary` | Weak areas, strong areas, avg score |
| GET | `/api/progress/timeline` | Session timeline |
| GET | `/api/progress/trend/:concept` | Score trend for a topic over time |
| GET | `/api/progress/streak` | Current daily streak |
| GET | `/api/progress/achievements` | All earned badges |
| GET | `/api/progress/leaderboard` | Personal session ranking |

### Questions
| Method | Path | Description |
|---|---|---|
| GET | `/api/questions` | List (filter by role/category/difficulty) |
| POST | `/api/questions` | Create question |
| PUT | `/api/questions/:id` | Update question |
| DELETE | `/api/questions/:id` | Deactivate question |
| POST | `/api/questions/from-jd` | Generate questions from a job description |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | JWT signing secret |
| `AGENT_SHARED_SECRET` | Yes | HMAC signing between services |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `GROQ_API_KEY` | Yes | Primary LLM provider |
| `FRONTEND_URL` | Yes | CORS origin (default: http://localhost:3002) |
| `OPENROUTER_API_KEY` | No | Fallback LLM if Groq quota exhausted |
| `REDIS_URL` | No | Redis for rate limiting (falls back to in-memory) |
| `MANAGER_PORT` | No | Default: 3000 |

---

## Docker

```bash
docker compose up --build
```

Starts: MongoDB, Redis, Manager API, 4 AI Agents, Frontend.

---

## Known Gaps / Next Steps

- **Whisper STT fallback** — currently browser-only. Add server-side Whisper/AssemblyAI in `src/services/speech/`.
- **Admin role guard** — question CRUD is open to all logged-in users. Add `isAdmin` to User model.
- **Email verification / password reset** — auth exists but no email flow yet.
- **Next.js middleware guard** — add `middleware.ts` for route-level auth instead of per-page checks.
- **Test coverage** — `answer-scorer.js`, `filler-detector.js`, `achievement-service.js`, and interview flow integration tests needed.
- **Docker env** — add `OPENROUTER_API_KEY` to the manager service block in `docker-compose.yml`.
