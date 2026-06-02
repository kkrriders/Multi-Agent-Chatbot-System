# MockPrep — Session Summary
**Date:** 2026-06-02  
**Branch:** main

---

## Overview

This session covered four major areas:
1. Full frontend UI overhaul (Stitch design system)
2. `.gitignore` fix for internal docs
3. Google + LinkedIn OAuth login
4. Achievements page wired to the database

---

## 1. Frontend UI Overhaul — Stitch Design System

Rebuilt every frontend page to match the `stitch_ai_interview_platform/` design files. All existing API logic, hooks, and state management were preserved — only the UI layer was replaced.

### Design System Setup

| File | Change |
|---|---|
| `frontend/app/globals.css` | Replaced dark blue theme with full Stitch light palette (40+ CSS tokens) |
| `frontend/app/layout.tsx` | Added Geist font (Google Fonts), Material Symbols icon font, switched default theme to `light` |

**Color tokens added:** `emerald-deep` (#065F46), `ink` (#0D0C22), `slate-muted` (#64748B), `amber-light` (#FEF3C7), full `surface-container-*` scale, `outline-variant`, all primary/secondary/tertiary/error scales.

### New Shared Component

**`frontend/components/sidebar.tsx`**  
Responsive sidebar with:
- Active link highlighting (left border + background)
- Logout button (calls `/api/auth/logout`, clears cookie)
- Mobile: fixed top bar + bottom nav (4 icons)
- Desktop: fixed 64px-wide left panel

### Pages Rebuilt (10 total)

| Route | Stitch Source | Notes |
|---|---|---|
| `/` | `mockprep_landing_page` | Hero + CV upload card + features bento grid + how-it-works steps |
| `/login` | `login` | Split layout (brand panel + form), Google/LinkedIn buttons |
| `/signup` | `sign_up` | Split layout with testimonial panel, social auth buttons |
| `/dashboard` | `candidate_dashboard` | Sidebar layout, streak card, weak area alert, performance bars, sessions table |
| `/interview` | `start_new_session` | 4-mode selection cards (Practice / Timed / Full / Panel), context inputs |
| `/interview/[sessionId]` | `interview_session_ai_persona` | Split layout: AI persona card (left) + live transcript chat (right) + bottom control bar with mic/timer |
| `/results/[sessionId]` | `interview_summary_report` | Animated SVG score ring, performance bars, speech metrics, per-answer breakdown |
| `/progress` | `interview_history_progress` | Sidebar layout, Recharts trend line, achievements grid, sessions list with circular score indicators |
| `/upload` | `cv_gap_analysis` | Drag-and-drop CV upload, gap analysis with match score ring, skill pills |
| `/profile` (new) | `profile_settings` | Tabbed settings: Personal Info + CV upload section |

### API Change

`frontend/lib/api.ts` — `interview.start()` now accepts optional `companyName` parameter (passes to `/api/interview/start`).

---

## 2. `.gitignore` Fix

**Problem:** `CLAUDE.md`, `FEATURES_ROADMAP.md`, `BUILD_LOG.md` were being pushed to GitHub despite being in `.gitignore`. Two root causes:

1. **Trailing slashes** — entries were `CLAUDE.md/` (directory pattern) instead of `CLAUDE.md` (file pattern)
2. **Already tracked** — once a file is committed, `.gitignore` has no effect; must run `git rm --cached`

**Fix applied:**
```
# Before (broken)
FEATURES_ROADMAP.md/
BUILD_LOG.md/
CLAUDE.md/

# After (correct)
CLAUDE.md
FEATURES_ROADMAP.md
BUILD_LOG.md
MOCKPREP_BUILD_SUMMARY.md   ← was missing entirely
```

Ran `git rm --cached CLAUDE.md FEATURES_ROADMAP.md MOCKPREP_BUILD_SUMMARY.md` — files remain on disk, removed from git index.

---

## 3. Google + LinkedIn OAuth Login

Stateless OAuth 2.0 flow — no `express-session` required. CSRF protection via HMAC-signed `state` parameter (10-minute TTL, uses `JWT_SECRET`).

### New Files

**`src/routes/oauth.js`**  
Handles both providers with a shared pattern:
- `GET /api/auth/google` → redirect to Google with signed state
- `GET /api/auth/google/callback` → verify state → exchange code → fetch profile → find-or-create user → issue JWT cookie → redirect to `/dashboard`
- `GET /api/auth/linkedin` / `GET /api/auth/linkedin/callback` — same flow

**Account linking:** if OAuth email matches an existing password account, the provider ID is linked to the same account (no duplicate users).

### Model Changes

**`src/models/User.js`**

| Field | Type | Notes |
|---|---|---|
| `googleId` | String | Optional, sparse unique index |
| `linkedinId` | String | Optional, sparse unique index |
| `avatarUrl` | String | Profile picture from provider |
| `password` | String | Now optional (OAuth users have no password) |

### Backend Wiring

**`server.js`** — OAuth routes registered on `/api/auth` (separate from CSRF middleware — OAuth uses its own state-based CSRF):
```js
app.use('/api/auth', authLimiter, oauthRoutes);
```

**`src/utils/validateEnv.js`** — Added `GOOGLE_CLIENT_ID` and `LINKEDIN_CLIENT_ID` to optional warnings list.

### New Environment Variables (`.env.example`)

```env
GOOGLE_CLIENT_ID=          # console.cloud.google.com
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=        # linkedin.com/developers/apps
LINKEDIN_CLIENT_SECRET=
BACKEND_URL=http://localhost:3000   # used for redirect URIs
```

### Frontend Changes

- `login/page.tsx` — Google/LinkedIn buttons call `window.location.href = ${API_URL}/api/auth/{provider}`; OAuth error from `?error=` query param shown in error banner; wrapped in `<Suspense>` (required by Next.js 15 for `useSearchParams`)
- `signup/page.tsx` — Same button behaviour via shared `OAuthButton` component

### Setup Instructions

**Google:**  
1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client  
2. Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`  
3. Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` to `.env`

**LinkedIn:**  
1. [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) → Create app  
2. Auth tab → Redirect URL: `http://localhost:3000/api/auth/linkedin/callback`  
3. Products → enable **Sign In with LinkedIn using OpenID Connect**  
4. Add `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` to `.env`

---

## 4. Achievements Page

### New File: `frontend/app/achievements/page.tsx`

Pulls from `/api/progress/achievements` (existing endpoint backed by the `achievements` MongoDB collection).

**Page sections:**

| Section | Content |
|---|---|
| Summary strip | Earned / Locked / Current streak / % complete |
| Progress bar | Gradient fill showing collection completion |
| Earned badges | Colored card with tier ring, icon, label, date earned, contextual metadata |
| Locked badges | Greyed card with lock overlay + unlock hint |
| Empty state | CTA to start first interview |

**All 10 badge types with tiers:**

| Type | Label | Tier | Unlock condition |
|---|---|---|---|
| `first_interview` | First Interview | Bronze | Complete any session |
| `score_80_plus` | High Performer | Silver | Score 80+ overall |
| `perfect_score` | Perfect Score | Gold | Score 100 on one answer |
| `streak_3` | 3-Day Streak | Bronze | 3 consecutive days |
| `streak_7` | Week Warrior | Silver | 7 consecutive days |
| `streak_30` | Monthly Champion | Gold | 30 consecutive days |
| `ten_sessions` | Dedicated Learner | Silver | 10 total sessions |
| `full_mock` | Full Mock Complete | Silver | Finish a Full Mock session |
| `speech_master` | Speech Master | Gold | Zero filler words in a voice answer (20+ words) |
| `improvement_10` | On The Rise | Silver | Improve overall score by 10+ points |

Contextual metadata displayed on earned badges (e.g. "Score went from 52 → 74", "7-day streak achieved").

### Sidebar Update

**`frontend/components/sidebar.tsx`** — Added Achievements entry (trophy icon `emoji_events`) between Performance and CV Analysis. Mobile bottom nav updated to show Achievements as the 4th icon.

---

## Bug Fixes

| Bug | Fix |
|---|---|
| `TypeError: Cannot read properties of undefined (reading 'label')` on `/progress` | `ach.badge?.label` with fallback to `ach.type` — API returned achievements with no `badge` field populated |
| `useSearchParams()` should be wrapped in Suspense boundary | Extracted `LoginForm` inner component, wrapped default export in `<Suspense>` |

---

## Files Changed This Session

### New Files
```
frontend/app/achievements/page.tsx
frontend/app/profile/page.tsx
frontend/components/sidebar.tsx
src/routes/oauth.js
SESSION_SUMMARY.md
```

### Modified Files
```
.env.example
.gitignore
frontend/app/globals.css
frontend/app/layout.tsx
frontend/app/page.tsx
frontend/app/dashboard/page.tsx
frontend/app/interview/page.tsx
frontend/app/interview/[sessionId]/page.tsx
frontend/app/login/page.tsx
frontend/app/progress/page.tsx
frontend/app/results/[sessionId]/page.tsx
frontend/app/signup/page.tsx
frontend/app/upload/page.tsx
frontend/components/sidebar.tsx
frontend/lib/api.ts
README.md
server.js
src/models/User.js
src/utils/validateEnv.js
```

---

## Known Gaps / Next Steps

- `frontend/middleware.ts` — add server-level auth guard so unauthenticated users are redirected from protected routes at the edge (currently handled client-side via `useRequireAuth`)
- Password reset email flow — backend routes exist, no email sender configured
- Admin role guard — question CRUD is open to all authenticated users
- Whisper STT fallback — currently browser-only Web Speech API
- `frontend/Dockerfile` — needed for `docker compose up` to include the Next.js container
- Adaptive difficulty — bump question difficulty after 3 consecutive high scores
