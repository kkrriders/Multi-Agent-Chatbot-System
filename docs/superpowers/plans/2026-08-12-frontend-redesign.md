# Engineering Blueprint Frontend Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MockPrep's glassmorphic "Luminous Intelligence" visual system with the
"Engineering Blueprint" system (corner-bracket cards, sharp corners, blue+amber accents,
monospace numerals) across every page and shared component, per
`docs/superpowers/specs/2026-08-12-frontend-redesign-design.md`.

**Architecture:** Nearly the entire visual transformation is achieved through a handful of
CSS token overrides in `frontend/app/globals.css` (Tailwind v4 `@theme` block) — remapping
the `rounded-*` and `shadow-*` utility scales and replacing `.glass-card`/`.glass-nav` with
new `.blueprint-card`/`.blueprint-nav` classes — because every page already consumes these
as Tailwind utility classes rather than through shared React components. That one foundation
task cascades to all 23 frontend files with zero per-file edits for radius/shadow/card-shell.
The remaining per-page work is narrow: swap the two literal class names, and wrap
score/timestamp/counter values in the new monospace utility.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4 (`@theme` CSS-based config, no
`tailwind.config.js`), TypeScript, Google Fonts (Inter, Hanken Grotesk, Geist, new: Geist Mono).

## Global Constraints

- No new UI component library — only shadcn (`npx shadcn add`) and MagicUI (already-vendored
  `motion`) may be used; this plan adds no dependencies at all, only CSS + JSX class edits.
- No changes to backend behavior, SSE handling, scoring logic, or data fetching — visual/CSS
  layer only. Do not touch files under `src/` (backend) at all.
- No copy/content rewrites beyond fitting new label conventions (e.g. `Q 03/12` counters) —
  not a content pass.
- `rounded-full` usages (avatars, icon badges, progress dots/rings, pill buttons) are never
  touched — only `rounded-md`/`lg`/`xl`/`2xl`/`3xl` get the sharp-corner remap.
- Monospace (`font-mono`) is scoped to scores, percentages, timestamps, counters, and badge
  labels — never applied to headings or body prose.
- Grid texture (`.blueprint-grid`) is applied only to hero/marketing section backgrounds —
  never inside dense card grids (dashboard, progress, leaderboard, questions, achievements).
- `BorderBeam` stays scoped to the landing page's primary CV-upload card only, per existing
  `CLAUDE.md` rule that animation stays on marketing surfaces.
- Dark theme remains the default/primary (`defaultTheme="system"` in `theme-provider.tsx` is
  unchanged); light theme must still render correctly with the same token system.
- No unit tests apply to this work (pure CSS/JSX styling, no logic changes). Verification is
  the manual Verification Protocol below, run at the end of every task.

## Verification Protocol

Referenced by every task below. `cd frontend; npm run dev` (port 3002) if the dev server
isn't already running.

1. Open the affected page(s) in the browser with the OS/browser in **light** theme, then
   toggle to **dark** theme (via the app's `ThemeToggle`) — confirm both render correctly,
   with visible corner brackets on blueprint-cards and no leftover blur/glass artifacts.
2. Resize to mobile (~375px), tablet (~768px), and desktop (~1280px+) widths — confirm no
   layout breakage (this app has had prior responsiveness fixes; don't regress them).
3. Exercise any interactive elements on the page (nav links, forms, buttons, hover states)
   — confirm nothing that worked before now fails; only appearance should change.
4. Confirm no browser console errors introduced by the change.
5. Eyeball contrast on the new hairline borders, corner brackets, and any monospace numeral
   against its background in both themes — none should be hard to read. If anything looks
   borderline, check it with the browser devtools contrast checker on the computed colors.

---

### Task 1: Foundation — design tokens, blueprint-card system, monospace font

**Files:**
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Produces: CSS classes `.blueprint-card`, `.blueprint-nav`, `.blueprint-grid` (used by every
  later task in place of `.glass-card`/`.glass-nav`); Tailwind utility `font-mono` repointed
  to Geist Mono; new color token `--color-accent-warn` (amber, both themes); remapped
  `--radius-md/lg/xl/2xl/3xl` and `--shadow-sm/md/lg/xl` scales (consumed automatically by
  every existing `rounded-*`/`shadow-*` utility class in the codebase — no other task needs
  to touch those utilities directly).

- [ ] **Step 1: Add the Geist Mono font link**

In `frontend/app/layout.tsx`, add a new `<link>` immediately after the existing Geist
stylesheet link (currently lines 24-27, the `family=Geist:wght@400;600;700` link) — keep
that existing link as-is (it's still used for headings via `font-geist`), just add this one
alongside it:

```tsx
        <link
          href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
```

- [ ] **Step 2: Add the monospace font token and amber accent token**

In `frontend/app/globals.css`, inside the `@theme { ... }` block, right after the existing
font declarations (after line 9, `--font-heading: ...`), add:

```css
  --font-mono: 'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
```

Then, in the same `@theme` block, right after the `--color-white: #FFFFFF;` line (line 34),
add the new amber accent token (light-mode value):

```css

  /* Blueprint accent — corner brackets, annotations, highlighted metrics */
  --color-accent-warn: #f59e0b;
```

- [ ] **Step 3: Add the dark-mode amber value**

In `frontend/app/globals.css`, inside the `.dark { ... }` block, right after the
`--color-amber-light: #4a3b00;` line, add:

```css
  --color-accent-warn: #fbbf24;
```

- [ ] **Step 4: Remap the radius scale to sharp corners (leave `rounded-full` alone)**

In `frontend/app/globals.css`, inside the `@theme { ... }` block, replace the single line
`--radius: 0.5rem;` (line 25) with:

```css
  --radius: 0.1875rem;
  --radius-sm: 0.1875rem;
  --radius-md: 0.1875rem;
  --radius-lg: 0.1875rem;
  --radius-xl: 0.25rem;
  --radius-2xl: 0.25rem;
  --radius-3xl: 0.25rem;
```

(Deliberately no `--radius-full` override — every `rounded-full` usage across the app is a
circular element — avatars, status dots, progress rings, pill buttons — and must stay fully
round.)

- [ ] **Step 5: Remap the shadow scale to hard, minimal-blur offsets**

In the same `@theme { ... }` block, immediately after the radius tokens added in Step 4,
add:

```css

  /* Hard, minimal-blur shadows — replaces Tailwind's soft default blur scale */
  --shadow-sm: 1px 1px 0 0 rgb(0 0 0 / 0.12);
  --shadow-md: 2px 2px 0 0 rgb(0 0 0 / 0.14);
  --shadow-lg: 2px 2px 0 0 rgb(0 0 0 / 0.18);
  --shadow-xl: 3px 3px 0 0 rgb(0 0 0 / 0.2);
```

- [ ] **Step 6: Replace `.glass-card`/`.glass-nav` with `.blueprint-card`/`.blueprint-nav`**

In `frontend/app/globals.css`, replace the entire `@layer components { ... }` block (lines
167-190, containing `.glass-card` and `.glass-nav`) with:

```css
@layer components {
  /* Blueprint card — flat surface, hairline border, corner brackets (no blur). */
  .blueprint-card {
    position: relative;
    background-color: var(--color-surface-container);
    border: 1px solid var(--color-outline-variant);
    isolation: isolate;
    background-image:
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn)),
      linear-gradient(var(--color-accent-warn), var(--color-accent-warn));
    background-repeat: no-repeat;
    background-size:
      10px 2px, 2px 10px,
      10px 2px, 2px 10px,
      10px 2px, 2px 10px,
      10px 2px, 2px 10px;
    background-position:
      top 0 left 0, top 0 left 0,
      top 0 right 0, top 0 right 0,
      bottom 0 left 0, bottom 0 left 0,
      bottom 0 right 0, bottom 0 right 0;
  }
  /* Flat nav/header chrome — no blur, hairline bottom border. */
  .blueprint-nav {
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-outline-variant);
  }
  /* Subtle graph-paper texture for hero/section backgrounds only. */
  .blueprint-grid {
    background-image:
      linear-gradient(color-mix(in srgb, var(--color-on-surface) 6%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--color-on-surface) 6%, transparent) 1px, transparent 1px);
    background-size: 40px 40px;
  }
}
```

- [ ] **Step 7: Tighten global transition timing to match the precise/technical motion feel**

In `frontend/app/globals.css`, inside `@layer base { * { ... } }` (originally line 195),
replace:

```css
    transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease, fill 0.25s ease;
```

with:

```css
    transition: background-color 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out, fill 0.15s ease-out;
```

- [ ] **Step 8: Verify the foundation compiles and renders**

Run: `cd frontend; npm run dev` (or confirm it's already running on port 3002).

Open `http://localhost:3002` in a browser. Follow the Verification Protocol above. At this
point the landing page will look broken/unstyled in places where old classes (`glass-card`,
`glass-nav`) no longer resolve to any CSS rule (they're removed, and no page has been
updated to use the new names yet) — that's expected here, it gets fixed in Task 2. Confirm
specifically that: the page loads without console/build errors, `rounded-full` elements
(e.g. the avatar circles in the landing hero) are still fully round, and buttons/cards using
`rounded-lg`/`rounded-xl` now show visibly sharp corners.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat: add Engineering Blueprint design tokens and blueprint-card system"
```

---

### Task 2: Retire `.glass-card`/`.glass-nav` across every remaining file

**Files:**
- Modify: `frontend/components/Topbar.tsx`
- Modify: `frontend/components/sidebar.tsx`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/app/upload/page.tsx`
- Modify: `frontend/app/results/[sessionId]/page.tsx`
- Modify: `frontend/app/progress/page.tsx`
- Modify: `frontend/app/interview/page.tsx`
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/interview/preview/page.tsx`
- Modify: `frontend/app/interview/[sessionId]/page.tsx`
- Modify: `frontend/app/questions/page.tsx`
- Modify: `frontend/app/profile/page.tsx`
- Modify: `frontend/app/leaderboard/page.tsx`
- Modify: `frontend/app/achievements/page.tsx`
- Modify: `frontend/app/practice/system-design/page.tsx`
- Modify: `frontend/app/practice/coding/page.tsx`

**Interfaces:**
- Consumes: `.blueprint-card` / `.blueprint-nav` classes from Task 1.
- Produces: every card-like container app-wide now uses the corner-bracket blueprint style;
  no file references `.glass-card` or `.glass-nav` anymore.

This is a literal, mechanical rename in every file listed above: every className occurrence
of the exact word `glass-card` becomes `blueprint-card`, and every occurrence of `glass-nav`
becomes `blueprint-nav`. Do not change any other class on the same element (spacing, radius,
color, and shadow utilities on these elements are already correct as-is — they pick up the
new look automatically via Task 1's token remap).

- [ ] **Step 1: Confirm the full list of occurrences**

Run: `cd frontend; grep -rn "glass-card\|glass-nav" app components`

Expected: one or more matches per file listed above (this list was generated the same way
before Task 1 was written — if the grep turns up a file not in the list above, include it
too; if a listed file has no matches, skip it).

- [ ] **Step 2: Replace every occurrence**

For each file with matches, replace the literal string `glass-card` with `blueprint-card`,
and the literal string `glass-nav` with `blueprint-nav`, in every className that contains
them. (E.g. `className="glass-card rounded-xl p-6 ..."` becomes
`className="blueprint-card rounded-xl p-6 ..."` — only the one token changes.)

- [ ] **Step 3: Verify no occurrences remain**

Run: `cd frontend; grep -rn "glass-card\|glass-nav" app components`

Expected: no output (empty result).

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on: landing (`/`), dashboard (`/dashboard`), login
(`/login`), upload (`/upload`), progress (`/progress`), leaderboard (`/leaderboard`),
questions (`/questions`), achievements (`/achievements`), profile (`/profile`) — spot-check
each one, confirming every former glass-card now renders as a flat, hairline-bordered card
with small amber corner brackets, and every former glass-nav renders as a flat, non-blurred
header/sidebar bar.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/Topbar.tsx frontend/components/sidebar.tsx frontend/app/page.tsx frontend/app/dashboard/page.tsx frontend/app/upload/page.tsx "frontend/app/results/[sessionId]/page.tsx" frontend/app/progress/page.tsx frontend/app/interview/page.tsx frontend/app/login/page.tsx frontend/app/interview/preview/page.tsx "frontend/app/interview/[sessionId]/page.tsx" frontend/app/questions/page.tsx frontend/app/profile/page.tsx frontend/app/leaderboard/page.tsx frontend/app/achievements/page.tsx frontend/app/practice/system-design/page.tsx frontend/app/practice/coding/page.tsx
git commit -m "feat: migrate every glass-card/glass-nav usage to the blueprint-card system"
```

---

### Task 3: Landing page polish — monospace score, hero grid texture, amber BorderBeam

**Files:**
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `.blueprint-grid` class and `--color-accent-warn` token from Task 1;
  `.blueprint-card` already applied to this file by Task 2.

- [ ] **Step 1: Add the graph-paper grid texture to the hero section**

In `frontend/app/page.tsx`, find the hero `<section>` opening tag (originally line 65):

```tsx
        <section className="w-full px-4 md:px-12 max-w-[1280px] mx-auto py-16 md:py-24 flex flex-col lg:flex-row items-center gap-12">
```

Add `blueprint-grid` to its className:

```tsx
        <section className="blueprint-grid w-full px-4 md:px-12 max-w-[1280px] mx-auto py-16 md:py-24 flex flex-col lg:flex-row items-center gap-12">
```

- [ ] **Step 2: Recolor the CV-upload card's BorderBeam to the amber accent**

Find the `<BorderBeam />` usage (originally line 110):

```tsx
              <BorderBeam size={120} duration={8} colorFrom="var(--color-primary)" colorTo="var(--color-emerald-deep)" />
```

Replace with:

```tsx
              <BorderBeam size={120} duration={8} colorFrom="var(--color-accent-warn)" colorTo="var(--color-primary)" />
```

- [ ] **Step 3: Apply monospace to the score readout**

Find the score span inside the "Real-time AI Scoring" bento card (originally line 162):

```tsx
                    <span className="font-geist font-bold text-3xl text-emerald-deep">86</span>
```

Add `font-mono` alongside the existing classes:

```tsx
                    <span className="font-mono font-bold text-3xl text-emerald-deep">86</span>
```

(Note: `font-geist` is dropped here specifically because a monospace font and a
proportional-sans font can't both apply — `font-mono` is the intended treatment for this
one numeral per the design spec. Every other `font-geist` heading on this page is untouched.)

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on `/`. Specifically confirm: the hero section shows
a faint graph-paper grid behind the text/CV-upload-card content, the BorderBeam trace around
the CV-upload card now cycles through amber, and the "86" score renders in the monospace
face while every other heading on the page still uses the Geist sans face.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: polish landing page with hero grid texture and monospace score"
```

---

### Task 4: Dashboard page polish — monospace metrics

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `font-mono` utility from Task 1; `.blueprint-card` already applied by Task 2.

- [ ] **Step 1: Monospace the average score**

Find (originally line 80):

```tsx
                <span className="font-heading text-4xl font-bold text-primary">{avgScore ?? '—'}</span>
```

Replace with:

```tsx
                <span className="font-mono text-4xl font-bold text-primary">{avgScore ?? '—'}</span>
```

- [ ] **Step 2: Monospace the completed-sessions count**

Find (originally line 97):

```tsx
                <span className="font-heading text-2xl font-bold text-primary">{completed.length} <span className="text-sm text-on-surface-variant font-normal">Sessions</span></span>
```

Replace with:

```tsx
                <span className="font-heading text-2xl font-bold text-primary"><span className="font-mono">{completed.length}</span> <span className="text-sm text-on-surface-variant font-normal">Sessions</span></span>
```

(Only the numeral goes monospace — the word "Sessions" and the outer heading font stay as
they were.)

- [ ] **Step 3: Monospace the recent-sessions score badges**

Find (originally lines 186-189):

```tsx
                        {s.overallScore != null ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${scoreBadgeClass(s.overallScore)}`}>
                            {s.overallScore}/100
                          </span>
```

Replace with:

```tsx
                        {s.overallScore != null ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${scoreBadgeClass(s.overallScore)}`}>
                            {s.overallScore}/100
                          </span>
```

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on `/dashboard` (requires a logged-in session — sign
up or log in first if needed). Confirm the average score, completed-session count, and every
score badge in the Recent Sessions table render in the monospace face, while section
headings ("Select Mode", "Recent Sessions", etc.) stay on the heading font. Confirm this page
does **not** get the `.blueprint-grid` texture (it's a dense card grid, excluded per the
Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: apply monospace metrics to dashboard"
```

---

### Task 5: Interview flow pages — monospace timers, scores, and question counters

**Files:**
- Modify: `frontend/app/interview/page.tsx` (session setup)
- Modify: `frontend/app/interview/[sessionId]/page.tsx` (active interview)
- Modify: `frontend/app/interview/preview/page.tsx` (post-answer preview)

**Interfaces:**
- Consumes: `font-mono` utility from Task 1; `.blueprint-card`/`.blueprint-nav` already
  applied by Task 2.

- [ ] **Step 1: Find monospace candidates in the active interview page**

Run: `cd frontend; grep -n -iE "score|timer|elapsed|countdown|[0-9]+\s*/\s*[0-9]+|toFixed|:[0-9]{2}\"" "app/interview/[sessionId]/page.tsx"`

For every JSX element the grep surfaces that renders a live numeric value to the user (a
score, a countdown/elapsed timer readout like `mm:ss`, or a question counter like
`{index + 1} / {total}`), add `font-mono` to that element's `className`. Do not add it to
elements that only render static label text (e.g. "Score", "Time Remaining") — only the
numeral/value itself.

- [ ] **Step 2: Find monospace candidates in the setup page**

Run: `cd frontend; grep -n -iE "score|timer|duration|[0-9]+\s*(min|questions)" app/interview/page.tsx`

Apply the same rule as Step 1: wrap only rendered numeric values (e.g. a selected session
duration or question-count readout) in `font-mono`, not their labels.

- [ ] **Step 3: Find monospace candidates in the preview page**

Run: `cd frontend; grep -n -iE "score|toFixed|[0-9]+\s*/\s*[0-9]+" app/interview/preview/page.tsx`

Apply the same rule as Step 1.

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on `/interview` (setup), then start a session and
check the active interview page and the post-answer preview. Specifically confirm any score
value, countdown/timer, and question counter (e.g. "Q 3 of 10") render in monospace while
surrounding prose and headings do not, and that the live SSE score-update flow still works
visually (a score updates in place without layout jumping).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/interview/page.tsx "frontend/app/interview/[sessionId]/page.tsx" frontend/app/interview/preview/page.tsx
git commit -m "feat: apply monospace metrics to the interview flow"
```

---

### Task 6: Results page — monospace scores and category breakdowns

**Files:**
- Modify: `frontend/app/results/[sessionId]/page.tsx`

**Interfaces:**
- Consumes: `font-mono` utility from Task 1; `.blueprint-card` already applied by Task 2.

- [ ] **Step 1: Find monospace candidates**

Run: `cd frontend; grep -n -iE "score|toFixed|overallScore|categoryScores|%|/100" "app/results/[sessionId]/page.tsx"`

Apply the same rule as Task 5 Step 1: wrap only the rendered numeric score/percentage
values in `font-mono` (overall score, per-category scores, percentages) — not their labels
("Clarity", "Confidence", "Overall Score", etc.) and not headings.

- [ ] **Step 2: Visual verification**

Follow the Verification Protocol above on a completed session's results page (`/results/<id>`
— complete an interview session first if none exists). Confirm every score number is
monospace, labels/headings are unchanged, and any score visualizations (bars, rings, charts)
still render correctly with the new card styling from Task 2.

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/results/[sessionId]/page.tsx"
git commit -m "feat: apply monospace scores to the results page"
```

---

### Task 7: Progress and Leaderboard pages — monospace metrics

**Files:**
- Modify: `frontend/app/progress/page.tsx`
- Modify: `frontend/app/leaderboard/page.tsx`

**Interfaces:**
- Consumes: `font-mono` utility from Task 1; `.blueprint-card` already applied by Task 2.

- [ ] **Step 1: Find monospace candidates in Progress**

Run: `cd frontend; grep -n -iE "score|toFixed|streak|%|/100|toLocaleDateString" app/progress/page.tsx`

Apply the standard rule (Task 5 Step 1): numeric values only, not labels or dates'
surrounding prose — but do wrap the date/timestamp values themselves in `font-mono`, since
timestamps are explicitly in scope per the design spec.

- [ ] **Step 2: Find monospace candidates in Leaderboard**

Run: `cd frontend; grep -n -iE "score|rank|#[0-9]|toFixed|%" app/leaderboard/page.tsx`

Apply the same rule — rank numbers and scores go monospace, names and labels do not.

- [ ] **Step 3: Visual verification**

Follow the Verification Protocol above on `/progress` and `/leaderboard`. Confirm this pair
of data-dense pages does **not** get `.blueprint-grid` texture (excluded per Global
Constraints — dense card grids), and that trend charts / sparklines (if any) still render
correctly against the new flat card background.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/progress/page.tsx frontend/app/leaderboard/page.tsx
git commit -m "feat: apply monospace metrics to progress and leaderboard pages"
```

---

### Task 8: Questions, Achievements, and Profile pages — monospace metrics

**Files:**
- Modify: `frontend/app/questions/page.tsx`
- Modify: `frontend/app/achievements/page.tsx`
- Modify: `frontend/app/profile/page.tsx`

**Interfaces:**
- Consumes: `font-mono` utility from Task 1; `.blueprint-card` already applied by Task 2.

- [ ] **Step 1: Find monospace candidates in Questions**

Run: `cd frontend; grep -n -iE "count|[0-9]+\s*(questions|difficulty)|%" app/questions/page.tsx`

Apply the standard rule — question counts and any difficulty/percentage indicators go
monospace; category names and question text do not.

- [ ] **Step 2: Find monospace candidates in Achievements**

Run: `cd frontend; grep -n -E "earnedCount|totalCount|streak" app/achievements/page.tsx`

The four stat numerals at (originally) lines 171, 175, 179, and 183 (`earnedCount`,
`totalCount - earnedCount`, `streak`, and the fourth stat) already use `font-geist
font-bold text-4xl` — add `font-mono` alongside `font-geist` on each of those four spans
specifically (keep `font-bold text-4xl` and the existing color classes unchanged).

- [ ] **Step 3: Find monospace candidates in Profile**

Run: `cd frontend; grep -n -iE "score|streak|count|[0-9]+" app/profile/page.tsx`

Apply the standard rule to any numeric stat displayed on the profile page.

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on `/questions`, `/achievements`, and `/profile`.
Confirm the four Achievements stat tiles show monospace numerals, and none of these three
pages picked up `.blueprint-grid` texture (all are dense-card pages, excluded per Global
Constraints).

- [ ] **Step 5: Commit**

```bash
git add frontend/app/questions/page.tsx frontend/app/achievements/page.tsx frontend/app/profile/page.tsx
git commit -m "feat: apply monospace metrics to questions, achievements, and profile pages"
```

---

### Task 9: Auth pages and Upload page — corner-bracket + monospace pass

**Files:**
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/signup/page.tsx`
- Modify: `frontend/app/upload/page.tsx`

**Interfaces:**
- Consumes: `font-mono` utility and `.blueprint-card` from Tasks 1-2 (already applied to
  login and upload; signup did not match the `glass-card`/`glass-nav` grep in Task 2, so it
  gets no card-class change here — verify in Step 1 whether that's still true).

- [ ] **Step 1: Confirm signup page's card treatment**

Run: `cd frontend; grep -n "rounded-xl\|rounded-lg" app/signup/page.tsx`

These pages primarily use plain bordered containers rather than `.glass-card`. No class
rename is needed here (Task 2 already confirmed no `glass-card`/`glass-nav` matches in this
file) — this step is just confirming the sharp-radius remap from Task 1 is visibly applied
(the containers should already look correct after Task 1; no edit needed if so).

- [ ] **Step 2: Find monospace candidates in Upload**

Run: `cd frontend; grep -n -iE "[0-9]+\s*(MB|KB)|progress|%" app/upload/page.tsx`

If the upload page renders a file-size readout or an upload-progress percentage, wrap that
numeral in `font-mono`. If the only numeric text is static copy like "MAX. 5MB" inside a
longer sentence, leave it as prose (per Global Constraints, monospace is for live/dynamic
values, not static copy).

- [ ] **Step 3: Visual verification**

Follow the Verification Protocol above on `/login`, `/signup`, and `/upload`. Confirm form
inputs, buttons, and cards all show the new sharp-corner treatment, and that login/signup
form submission still works end-to-end (this is an auth-critical flow — do not just
eyeball it, actually log in and sign up with a test account).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/login/page.tsx frontend/app/signup/page.tsx frontend/app/upload/page.tsx
git commit -m "feat: apply blueprint styling pass to auth and upload pages"
```

---

### Task 10: Practice pages (coding, system-design) and their components

**Files:**
- Modify: `frontend/app/practice/coding/page.tsx`
- Modify: `frontend/app/practice/system-design/page.tsx`
- Modify: `frontend/components/CodeEditor.tsx`
- Modify: `frontend/components/SystemDesignCanvas.tsx`

**Interfaces:**
- Consumes: `.blueprint-card` from Task 2 (already applied to both page files); `font-mono`
  utility from Task 1.

- [ ] **Step 1: Check CodeEditor for conflicting monospace usage**

Run: `cd frontend; grep -n "font-mono\|monospace" components/CodeEditor.tsx`

`CodeEditor.tsx` likely already sets its own monospace font for the code-editing surface
itself (that's expected and correct — code editors are always monospace, this predates and
is unrelated to the new design-system `font-mono` token). No change needed there unless the
grep shows it's hardcoding a different mono font stack than `--font-mono` — if so, leave it
as-is; a code editor's font choice is a separate functional concern, not part of this
redesign's scope.

- [ ] **Step 2: Find monospace candidates in the two practice pages**

Run: `cd frontend; grep -n -iE "score|toFixed|difficulty|%|[0-9]+\s*/\s*[0-9]+" app/practice/coding/page.tsx app/practice/system-design/page.tsx`

Apply the standard rule from Task 5 Step 1 to any AI-evaluation score or numeric readout
surfaced on these pages.

- [ ] **Step 3: Check SystemDesignCanvas for card-shell consistency**

Run: `cd frontend; grep -n "rounded-lg\|rounded-xl\|shadow" components/SystemDesignCanvas.tsx`

Confirm these already pick up the sharp-corner/hard-shadow treatment from Task 1's token
remap automatically (no edit expected — just confirm visually in Step 4).

- [ ] **Step 4: Visual verification**

Follow the Verification Protocol above on `/practice/coding` and `/practice/system-design`.
Confirm the code editor and design canvas remain fully functional (typing code, drawing on
the canvas), any AI-evaluation score renders in monospace, and surrounding chrome uses the
new blueprint-card styling.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/practice/coding/page.tsx frontend/app/practice/system-design/page.tsx frontend/components/CodeEditor.tsx frontend/components/SystemDesignCanvas.tsx
git commit -m "feat: apply blueprint styling pass to practice pages"
```

---

### Task 11: Final sweep and full-app QA

**Files:**
- Modify: none expected (verification-only task; fix forward here if issues are found)

**Interfaces:**
- Consumes: everything from Tasks 1-10.

- [ ] **Step 1: Confirm no old classes remain anywhere**

Run: `cd frontend; grep -rn "glass-card\|glass-nav" app components`

Expected: no output. If anything remains, fix it inline in this task before proceeding.

- [ ] **Step 2: Confirm no stray hardcoded blur remains**

Run: `cd frontend; grep -rn "backdrop-filter\|backdrop-blur" app components`

Expected: no output outside of anything intentionally unrelated to cards/nav (e.g. a modal
overlay backdrop is a different concern — use judgment; the design spec targets card/nav
glassmorphism specifically). Fix inline if a leftover glass-style backdrop-filter is found
on a card or nav element.

- [ ] **Step 3: Full-app visual sweep**

Follow the Verification Protocol above on every remaining page not already spot-checked in
an earlier task's Step: `/`, `/dashboard`, `/login`, `/signup`, `/upload`, `/interview`,
`/interview/[an active session]`, `/results/[a completed session]`, `/progress`,
`/leaderboard`, `/questions`, `/achievements`, `/profile`, `/practice/coding`,
`/practice/system-design`. For each: toggle light/dark, check mobile/tablet/desktop, click
through primary interactions.

- [ ] **Step 4: Check browser console across the sweep**

While doing Step 3, keep devtools open and confirm zero new console errors/warnings were
introduced (pre-existing warnings unrelated to this change, e.g. the known `Big Shoulders`
font-override warning noted in a prior session, are not this task's concern).

- [ ] **Step 5: Fix any regressions found, then commit**

If Steps 1-4 found nothing to fix, skip committing (no changes). If fixes were needed:

```bash
git add -A frontend
git commit -m "fix: address regressions found in final blueprint redesign sweep"
```
