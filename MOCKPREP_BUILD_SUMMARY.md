# MockPrep — Build Summary
**Date:** 2026-05-28  
**Project:** `C:\Users\karti\Mockprep`  
**Stack:** Node.js / Express backend · Next.js 15 / TypeScript frontend · MongoDB · Redis · Groq API

---

## What Was Built

This session transformed the existing multi-agent chatbot codebase into a full mock interview platform implementing all 20 planned features across 6 categories.

---

## 1. Infrastructure (from repo research)

### Multi-Provider AI Service (`src/services/ai/`)
- **`providers/groq-provider.js`** — Wraps existing Groq SDK with error classification (`quota_exhausted`, `auth_invalid`, `transient`, `unrecoverable`)
- **`providers/openrouter-provider.js`** — Secondary fallback provider using OpenRouter API
- **`provider-manager.js`** — Automatic fallback chain: Groq → OpenRouter. Model tiers: `fast` (llama-3.1-8b), `balanced` (llama-3.3-70b), `quality` (qwen3-32b). Wraps existing `withRetry` from `src/shared/retry.js`.

### SSE Broadcaster (`src/services/sse/broadcaster.js`)
- Real-time Server-Sent Events per interview session
- Events: `connected`, `scoring-start`, `score-update`, `scoring-error`, `speech-event`, `timer-tick`, `session-ended`
- Auto-heartbeat every 25s to survive proxies
- Used in active interview page for live score delivery

### 3-Layer History / Observation System (`src/services/history/`)
- **`observation-compiler.js`** — Records typed observations (`speech_quality`, `technical_accuracy`, `cv_gap`, `weak_area`, `strong_area`) per candidate per session
- **`retrieval-service.js`** — 3-layer retrieval: Layer 1 = compact index (~50 tokens), Layer 2 = timeline, Layer 3 = full detail. Also exposes `progressSummary()` and `conceptTrend()`

### Prompt Injection Guard (`src/middleware/injection-guard.js`)
- 16 regex patterns covering classic injection attacks (`ignore previous instructions`, `act as`, `reveal your system prompt`, etc.)
- Used as Express middleware on CV upload and JD endpoints
- Also exposes `assertSafe()` for use inside services

---

## 2. MongoDB Models (`src/models/`)

| Model | Purpose |
|---|---|
| `Interview.js` | Session record — mode, status, scores, timing, questionIds |
| `Question.js` | Question bank — category, role, difficulty, expectedKeywords, source |
| `Answer.js` | Per-answer record — text, inputMethod, scores, speechMetrics, suggestions |
| `CandidateProfile.js` | CV data — skills, experience, education, cvText, skillGaps |
| `Observation.js` | Longitudinal event store — typed, queryable, 3-layer indexed |
| `Achievement.js` | Badges — 10 badge types, unique per user, metadata attached |

---

## 3. Backend Services

### CV Pipeline (`src/services/cv/`)
- **`cv-parser.js`** — Extracts text from PDF (pdf-parse), DOCX (mammoth), TXT
- **`skill-extractor.js`** — AI extraction of name, skills, experience, education from CV text
- **`gap-analyzer.js`** — Compares CV skills to JD requirements, returns missingSkills, matchedSkills, fitScore

### Interview Core (`src/services/interview/`)
- **`question-generator.js`** — Pulls from question bank first, generates AI questions for gaps. Mode-specific distributions (practice/timed/full). Saves generated questions for future reuse.
- **`answer-scorer.js`** — Parallel scoring on 3 dimensions (relevance, depth, clarity) 0-100 each. Verification gate: rejects responses missing `evidence` field. Emits SSE events during scoring. Includes `aggregate()` for session summary.
- **`session-manager.js`** — Full session lifecycle: create → submit answer → complete. Async scoring (fire-and-forget), observation recording, achievement checks, SSE close on complete.

### Speech (`src/services/speech/filler-detector.js`)
- Detects filler words (um, uh, like, basically, you know, etc.) including multi-word fillers
- Detects repeated consecutive words
- Calculates WPM and pace label (too slow / slow / ideal / fast / too fast)
- Pronunciation confidence score 0-100 (penalises filler ratio + repetitions)

### Gamification (`src/services/gamification/achievement-service.js`)
- 10 badge types: `first_interview`, `score_80_plus`, `perfect_score`, `streak_3/7/30`, `ten_sessions`, `full_mock`, `speech_master`, `improvement_10`
- `getCurrentStreak()` — counts consecutive days with at least one completed session
- `getPersonalLeaderboard()` — user's own sessions ranked by score
- All checks run after every completed interview, non-throwing

---

## 4. Express Routes (registered in manager)

| Route | File | Features |
|---|---|---|
| `POST /api/cv/upload` | `src/routes/cv.js` | CV upload with multer, injection guard, AI parse |
| `GET /api/cv/profile` | `src/routes/cv.js` | Fetch current candidate profile |
| `POST /api/cv/analyze-gap` | `src/routes/cv.js` | JD gap analysis |
| `POST /api/interview/start` | `src/routes/interview.js` | Create session, generate questions |
| `GET /api/interview/stream/:sessionId` | `src/routes/interview.js` | SSE connection |
| `GET /api/interview/:sessionId` | `src/routes/interview.js` | Session state |
| `POST /api/interview/:sessionId/answer` | `src/routes/interview.js` | Submit answer, speech metrics |
| `POST /api/interview/:sessionId/complete` | `src/routes/interview.js` | Finalise, compute summary |
| `GET /api/interview/:sessionId/summary` | `src/routes/interview.js` | Full results |
| `GET /api/interview/history` | `src/routes/interview.js` | Past sessions |
| `GET /api/progress/summary` | `src/routes/progress.js` | Weak/strong areas, avg score |
| `GET /api/progress/timeline` | `src/routes/progress.js` | Session timeline (Layer 2) |
| `GET /api/progress/trend/:concept` | `src/routes/progress.js` | Score trend over time |
| `GET /api/progress/streak` | `src/routes/progress.js` | Current daily streak |
| `GET /api/progress/achievements` | `src/routes/progress.js` | All earned badges |
| `GET /api/progress/leaderboard` | `src/routes/progress.js` | Personal session ranking |
| `GET /api/questions` | `src/routes/questions.js` | List with filters |
| `POST /api/questions` | `src/routes/questions.js` | Create question |
| `PUT /api/questions/:id` | `src/routes/questions.js` | Update question |
| `DELETE /api/questions/:id` | `src/routes/questions.js` | Deactivate question |
| `POST /api/questions/from-jd` | `src/routes/questions.js` | Generate from job description |

---

## 5. Frontend (complete rewrite of `multi-agent-chatbot/`)

Old chatbot pages (`/chat`, chatbot components) were deleted. The Radix UI component library (`components/ui/`) was kept.

### New Files

#### Library
- **`lib/api.ts`** — Typed API client covering all backend routes. Interfaces: `CandidateProfile`, `Question`, `Answer`, `Interview`, `Achievement`.
- **`hooks/useSSE.ts`** — EventSource hook with auto-reconnect on disconnect. Handles all interview SSE event types.
- **`hooks/useSpeech.ts`** — Web Speech API hook with start/stop/reset, live transcript, duration timer.
- **`components/nav.tsx`** — Top navigation bar with all 6 main routes + logout.

#### Pages

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Landing page with feature cards and CTAs |
| `/login` | `app/login/page.tsx` | Clean login form, redirects to `/dashboard` |
| `/signup` | `app/signup/page.tsx` | Signup form |
| `/dashboard` | `app/dashboard/page.tsx` | Stats (sessions, avg score, streak, weak areas), quick actions, recent sessions |
| `/upload` | `app/upload/page.tsx` | Drag-and-drop CV upload, skill preview, gap analysis with JD |
| `/interview` | `app/interview/page.tsx` | Mode selector (practice/timed/full), role input, JD textarea |
| `/interview/[sessionId]` | `app/interview/[sessionId]/page.tsx` | Active interview — progress bar, question card, text/voice input, timed countdown, live score panel via SSE |
| `/results/[sessionId]` | `app/results/[sessionId]/page.tsx` | Score ring, category scores, progress insights, per-answer accordion with speech metrics |
| `/progress` | `app/progress/page.tsx` | Recharts score-over-time line chart, weak/strong areas, CV gaps |
| `/leaderboard` | `app/leaderboard/page.tsx` | Badges grid, personal session ranking with medals |
| `/questions` | `app/questions/page.tsx` | Question bank CRUD, category/difficulty/role filters, create form |

---

## 6. New Dependencies Installed

```bash
npm install multer pdf-parse   # backend: CV file upload and PDF text extraction
```

Frontend already had: `recharts`, `lucide-react`, `sonner`, all Radix UI components.

---

## 7. Environment Variables Added

Add to `.env`:
```
# Optional: secondary AI provider if Groq quota is exhausted
OPENROUTER_API_KEY=your_key_here
OPENROUTER_DEFAULT_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

---

## 8. Feature Coverage

| # | Feature | Status | Files |
|---|---|---|---|
| 1 | CV/Resume Upload & Parsing | ✅ | `services/cv/cv-parser.js`, `routes/cv.js` |
| 2 | AI Question Generation | ✅ | `services/interview/question-generator.js` |
| 3 | Answer Submission | ✅ | `routes/interview.js`, `session-manager.js` |
| 4 | Real-time Scoring | ✅ | `services/interview/answer-scorer.js`, SSE |
| 5 | Session Summary Report | ✅ | `session-manager.js`, `/results` page |
| 6 | Speech-to-Text | ✅ | `hooks/useSpeech.ts` (Web Speech API) |
| 7 | Clarity/Filler Word Detection | ✅ | `services/speech/filler-detector.js` |
| 8 | Pronunciation Confidence Score | ✅ | `filler-detector.js` |
| 9 | CV Gap Analysis | ✅ | `services/cv/gap-analyzer.js` |
| 10 | Weak Area Detection | ✅ | `observation-compiler.js`, `session-manager.js` |
| 11 | Answer Improvement Suggestions | ✅ | `answer-scorer.js` |
| 12 | Progress Tracking | ✅ | `services/history/`, `/progress` page |
| 13 | Practice Mode | ✅ | `session-manager.js`, `question-generator.js` |
| 14 | Timed Interview Mode | ✅ | Timer in `interview/[sessionId]` page |
| 15 | Mock Full Interview | ✅ | `full` mode with intro→technical→behavioral→closing |
| 16 | Session Score Ranking | ✅ | `achievement-service.js`, `/leaderboard` page |
| 17 | Streak Tracking | ✅ | `getCurrentStreak()`, dashboard |
| 18 | Achievement Badges | ✅ | 10 badge types, `/leaderboard` page |
| 19 | Question Bank Management | ✅ | `routes/questions.js`, `/questions` page |
| 20 | Job Description Input | ✅ | Interview setup, `questions/from-jd` route |

---

## 9. What Still Needs Doing

- **Whisper fallback for STT** — currently browser Web Speech API only. For server-side transcription, integrate OpenAI Whisper or AssemblyAI in `src/services/speech/`.
- **Admin role guard** — question bank CRUD is currently open to all authenticated users. Add an `isAdmin` field to the User model and check it in `routes/questions.js`.
- **Email auth** — the backend has signup/login but no email verification or password reset.
- **Test coverage** — unit tests for `answer-scorer.js`, `filler-detector.js`, `achievement-service.js`, and integration tests for the `/api/interview` flow.
- **Docker update** — `docker-compose.yml` does not yet include `OPENROUTER_API_KEY` in the manager service env block.
- **Frontend auth guard** — individual pages redirect to `/login` via `checkAuth()` but there is no middleware-level protection. Add `middleware.ts` for Next.js route protection.
