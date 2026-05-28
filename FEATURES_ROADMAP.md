# MockPrep — Feature Roadmap & Implementation Guide

> This file exists so Claude Code can read it at the start of a new session and
> immediately understand what is built, what comes next, and the decisions already
> made so we don't relitigate them.

---

## Status Legend
- ✅ Built and committed
- 🔧 Scaffold exists, needs completion
- 📋 Designed, not yet started
- 💡 Idea, needs design first

---

## Phase 1 — Core Platform (✅ Complete)

All 20 original features are implemented in the backend.

### Backend (all ✅)
| # | Feature | File |
|---|---|---|
| 1 | CV Upload & Parsing (PDF/DOCX/TXT) | `src/services/cv/cv-parser.js` |
| 2 | AI Question Generation (CV + JD) | `src/services/interview/question-generator.js` |
| 3 | Answer Submission (text + voice) | `src/routes/interview.js` |
| 4 | Real-time Scoring (relevance/depth/clarity) | `src/services/interview/answer-scorer.js` |
| 5 | Session Summary Report | `src/services/interview/session-manager.js` |
| 6 | Speech-to-Text (Web Speech API) | `frontend/hooks/useSpeech.ts` |
| 7 | Filler Word Detection | `src/services/speech/filler-detector.js` |
| 8 | Pronunciation Confidence Score | `src/services/speech/filler-detector.js` |
| 9 | CV Gap Analysis vs JD | `src/services/cv/gap-analyzer.js` |
| 10 | Weak Area Detection | `src/services/history/observation-compiler.js` |
| 11 | Answer Improvement Suggestions | `src/services/interview/answer-scorer.js` |
| 12 | Progress Tracking (3-layer history) | `src/services/history/retrieval-service.js` |
| 13 | Practice Mode | `src/services/interview/session-manager.js` |
| 14 | Timed Interview Mode | `src/routes/interview.js` |
| 15 | Full Mock Interview (intro→technical→behavioral→closing) | `src/services/interview/question-generator.js` |
| 16 | Personal Session Leaderboard | `src/services/gamification/achievement-service.js` |
| 17 | Daily Practice Streaks | `src/services/gamification/achievement-service.js` |
| 18 | Achievement Badges (10 types) | `src/models/Achievement.js` |
| 19 | Question Bank CRUD | `src/routes/questions.js` |
| 20 | JD Input (tailors questions) | `src/routes/questions.js` → `from-jd` |

### Frontend (🔧 Scaffold exists, pages need populating)
The `frontend/` directory has `package.json`, `tsconfig.json`, `next.config.mjs` but the actual page files from `multi-agent-chatbot/` need to be moved in.

Files to copy from git history or rebuild:
- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/app/page.tsx` (landing)
- `frontend/app/login/page.tsx`
- `frontend/app/signup/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/upload/page.tsx`
- `frontend/app/interview/page.tsx`
- `frontend/app/interview/[sessionId]/page.tsx`
- `frontend/app/results/[sessionId]/page.tsx`
- `frontend/app/progress/page.tsx`
- `frontend/app/leaderboard/page.tsx`
- `frontend/app/questions/page.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/auth.ts`
- `frontend/lib/config.ts`
- `frontend/hooks/useSSE.ts`
- `frontend/hooks/useSpeech.ts`
- `frontend/components/nav.tsx`
- `frontend/components/theme-provider.tsx`
- `frontend/components/ui/` (all 40+ Radix UI components)

All these files exist in git history at commit `4c53dc3` under `multi-agent-chatbot/`.
Retrieve with: `git show 4c53dc3:multi-agent-chatbot/app/dashboard/page.tsx`

---

## Phase 2 — Interview Quality (📋 Designed, not started)

### 2A. Adaptive Follow-up System (highest priority)
**The problem it solves:** Current flow asks Q1 → Q2 → Q3 regardless of what you said. Real interviews adapt.

**How it works:** After every answer, a decision agent runs before the next question:
```
Decision prompt → { action: 'follow_up' | 'probe_deeper' | 'next_question' | 'challenge', reason, response }
```
- `follow_up` — answer was too vague, ask to elaborate
- `probe_deeper` — good answer but missed something specific
- `next_question` — sufficient answer, move on
- `challenge` — answer had a technical flaw, push back

**Implementation:**
- New file: `src/services/interview/decision-agent.js`
- Called from `session-manager.submitAnswer()` after scoring completes
- Uses `balanced` tier (llama-3.3-70b) — 1 extra Groq call per answer
- Result stored in `Answer.followUpAction` field (add to schema)
- Frontend: if `follow_up` or `challenge`, show the agent's response before next question

**Key constraint:** This adds 1 Groq call per answer on top of the scoring call. At `fast` tier for scoring + `balanced` for decision = 2 calls per answer. Still within limits for low concurrency.

---

### 2B. Panel Interview Mode (4th interview mode)
**The problem it solves:** ~30% of real tech interviews are multi-panel. No mock tool simulates this well.

**CRITICAL architectural decision already made:**
- Do NOT use parallel Groq calls (4 simultaneous = rate limit death)
- Do NOT use separate processes (the old 4-agent chatbot approach — removed intentionally)
- USE: single model with multi-persona prompt for question generation
- USE: single model with multi-perspective prompt for end-of-session feedback

**3 interviewer personas:**
```js
{
  technical: { name: 'Alex', role: 'Senior Engineer', focus: ['technical', 'system_design'], model: 'llama-3.3-70b-versatile' },
  behavioural: { name: 'Priya', role: 'Hiring Manager', focus: ['behavioral', 'situational'], model: 'qwen/qwen3-32b' },
  challenger: { name: 'James', role: 'Bar Raiser', focus: ['closing', 'technical'], model: 'deepseek-r1-distill-llama-70b' }
}
```

**How questions work in panel mode:**
- One AI call generates a structured question set: `{ alex: [...], priya: [...], james: [...] }`
- Questions are tagged with `interviewerName` field
- UI shows which interviewer is asking each question
- Interviewers take turns (sequential, not parallel)

**End-of-session feedback:**
- ONE Groq call: "Provide feedback from 3 perspectives: Alex (technical depth), Priya (communication), James (critical thinking)"
- Response format: `{ alex: { score, strengths, gaps }, priya: {...}, james: {...} }`
- NOT `Promise.all([call1, call2, call3])` — forbidden

**Implementation files:**
- `src/services/interview/panel-interviewer.js` — persona configs + single-call question generation
- `src/services/interview/session-feedback.js` — single-call multi-perspective feedback
- Add `panel` to Interview model mode enum
- Add `interviewerName` field to Question schema
- Frontend: interviewer name + avatar shown above each question

---

### 2C. BullMQ Scoring Queue (replace setImmediate)
**The problem it solves:** With 30+ concurrent users, `setImmediate` fires 30 simultaneous Groq calls → rate limited → all fail silently.

**How it works:**
```
submitAnswer() → scoringQueue.add({ answerId, questionText, answerText, sessionId })
Worker (concurrency: 5) → scorer.score() → Answer update → SSE emit
```

**Implementation:**
- Install: `npm install bullmq`
- New file: `src/services/queue/scoring-queue.js`
- Worker concurrency = 5 (safe for Groq free tier 30 req/min across all models)
- Redis is already configured — BullMQ uses it automatically
- Replace `setImmediate` in `session-manager.submitAnswer()` with `scoringQueue.add()`
- Job timeout: 30s, retry: 2 attempts with backoff

---

## Phase 3 — Agentic Intelligence (📋 Designed, not started)

### 3A. Company Research Agent
**The problem it solves:** Generic questions don't prepare you for Stripe vs Amazon vs Google. Each company has distinct interview patterns.

**CRITICAL naming decision already made:**
This is what makes MockPrep legitimately "multi-agent" — each agent has tools, memory, and autonomy. NOT just prompt personas.

**Architecture:**
```
User: "I'm interviewing at Stripe for Senior Backend"
         ↓
Orchestrator
  ├── ResearchAgent (tool: web search via Exa/Tavily MCP)
  │     Searches: Stripe eng blog, Glassdoor interview reports, job description
  │     Output: { companyProfile, interviewFormat, focusAreas, sampleQuestions }
  │
  ├── ProfileAgent (tool: MongoDB — reads user's observation history)
  │     Output: { weakAreas, strongAreas, skillGaps, avgScores }
  │
  └── QuestionGeneratorAgent
        Input: companyProfile + userProfile
        Output: tailored question set
```

**Implementation files:**
- `src/services/agents/orchestrator.js` — coordinates agent sequence
- `src/services/agents/research-agent.js` — uses web search tool
- `src/services/agents/profile-agent.js` — reads user history
- Add Exa MCP or Tavily API key to `.env.example`
- New company knowledge base: `src/data/companies/` (curated JSON files for top 20 companies as fallback)

**Company data structure:**
```json
{
  "stripe": {
    "interviewFormat": "4-5 rounds: 2 coding, 1 system design, 1 behavioral, 1 hiring manager",
    "evaluationCriteria": ["distributed systems", "API design", "financial accuracy"],
    "knownQuestionPatterns": ["design payment processing system", "rate limiting implementation"],
    "redFlags": ["no error handling", "ignoring edge cases"],
    "source": "curated",
    "lastVerified": "2026-01"
  }
}
```

**Transparency rule:** Always show the source and confidence level in the UI. "Based on verified 2026 data" vs "Based on general Senior Backend patterns — no company data available."

---

### 3B. Adaptive Difficulty
**The problem it solves:** Questions don't adjust based on how well you're doing. If you're acing technical Qs, you should get harder ones.

**How it works:**
- After every 3 answers, calculate rolling average score
- If > 80: next question difficulty bumps up one level
- If < 50: next question difficulty drops one level
- Tracked in `Interview.currentDifficulty` field (add to schema)

**Simple implementation — no new agent needed:**
- Add to `session-manager.submitAnswer()` after observation is recorded
- `question-generator.selectNext(difficulty)` picks from bank at adjusted difficulty
- Works with existing models

---

### 3C. Code Execution Sandbox (for coding questions)
**The problem it solves:** AI cannot reliably judge if code is correct without running it. Scoring coding answers by text analysis is inaccurate.

**Implementation:**
- Use Judge0 API (free tier: 100 submissions/day) or Piston API (open source, self-hosted)
- New file: `src/services/interview/code-executor.js`
- New question type: `coding` (add to Question category enum)
- For coding questions: frontend shows code editor (Monaco editor or CodeMirror)
- On submit: code sent to executor, test results returned, scorer uses pass/fail + output in prompt

**Priority:** Medium — adds significant complexity. Build after adaptive follow-up and panel mode.

---

## Phase 4 — Production Hardening (💡 Ideas)

### 4A. Next.js Auth Middleware
- Add `frontend/middleware.ts` for route-level protection
- Currently auth is per-page via `checkAuth()` — this is fragile

### 4B. Admin Role Guard
- Add `isAdmin: Boolean` to `User.js` schema
- Question bank CRUD (`POST/PUT/DELETE /api/questions`) should check `req.user.isAdmin`
- Currently open to all authenticated users

### 4C. Email Verification + Password Reset
- Auth exists but no email flow
- Use Resend or Nodemailer
- Add `emailVerified: Boolean`, `resetToken`, `resetTokenExpiry` to User schema

### 4D. Docker Compose Update
- Add `OPENROUTER_API_KEY` to manager service env block
- Add BullMQ worker as a separate service (or run in same process)
- Remove old agent service definitions (agent-1 through agent-4 containers)

---

## Architectural Decisions — Do Not Revisit

These were explicitly decided and should not be changed without discussion:

| Decision | Rationale |
|---|---|
| Single Express process (not 4 agent processes) | 4 processes don't give 4x Groq capacity. They share the same rate limit. Single process has same parallelism via async I/O with no inter-process overhead. |
| Sequential Groq calls only — no `Promise.all` for AI | Groq free tier: 30 req/min shared across all users. Parallel calls from multiple users stack. `qwen3-32b` is only 6,000 tokens/min. |
| Single model with persona prompts for panel (not 4 models) | 4 parallel models = 4x rate limit burn. One model simulating 3 personas in one call = same quality, 1x cost. |
| SSE for real-time (not Socket.IO for new features) | Socket.IO exists from old chatbot, kept for backward compat. All new real-time features use SSE broadcaster. |
| `setImmediate` for scoring (temporary) | Will be replaced with BullMQ queue. `setImmediate` is good enough for single-user dev/testing. |
| No content score for system design answers | LLMs cannot verify technical correctness without tool use. Score structure/communication/trade-off-awareness. Flag technical correctness as "unverified." |
| Curated company database (not 100% live search) | Glassdoor data is noisy/outdated. Top 20 companies in curated JSON + live search for supplementary context only. |

---

## What Makes MockPrep Defensible (the pitch)

Not "multi-agent chat" — that's 2023. The defensible framing:

**"The only mock interview platform that researches your target company and simulates that company's specific interview style"**

Technical defence of "multi-agent":
- Research Agent has web search tool — autonomous, can decide what to search
- Profile Agent reads MongoDB history — has persistent memory across sessions
- Orchestrator coordinates agents and passes findings between them
- Interview Agent adapts based on research + profile output — not a static script
- This is a real agentic pipeline, not prompt personas

Each agent has: specialised role + tools + its own context + communicates results. That's multi-agent.

---

## Key Numbers to Keep in Mind

- Groq free tier: 30 req/min, 1,000 req/day for 70b models
- qwen3-32b: only 6,000 tokens/min — ~5 gap analysis calls per minute max
- Target AI calls per interview session: 10-15 total
- BullMQ worker concurrency target: 5 (safe for free tier with multiple users)
- Top companies to curate first: Google, Amazon, Meta, Stripe, Uber, Microsoft, Apple, Netflix, Airbnb, Coinbase, OpenAI, DeepMind, Anthropic, Goldman Sachs, JP Morgan (for fintech roles)

---

## Next Session Starting Point

**Recommended build order:**
1. Populate `frontend/` with the page files (recover from git history at `4c53dc3`)
2. Build `decision-agent.js` (adaptive follow-up) — highest impact on interview quality
3. Build `panel-interviewer.js` + panel mode — differentiating feature
4. Replace `setImmediate` with BullMQ queue — production stability
5. Build company research agent (requires Exa/Tavily MCP setup first)

**To start next session:**
Read this file + `CLAUDE.md` + `MOCKPREP_BUILD_SUMMARY.md` for full context.
