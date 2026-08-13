# Frontend Redesign — "Session Console" Design System

**Date:** 2026-08-13
**Status:** Approved, ready for implementation planning
**Supersedes:** `2026-08-12-frontend-redesign-design.md` ("Engineering Blueprint")

## Context

The "Engineering Blueprint" system (corner-bracket cards, sharp corners, hairline borders,
graph-paper grid) shipped in full across all ~15 frontend pages on 2026-08-12/13. On review,
the product owner found it read as a token-level restyle rather than a redesign — same
layout skeleton, same generic dark-navy-SaaS shape, with borders and fonts swapped. This spec
replaces it outright rather than iterating on it: new layout patterns, new type system, new
color language, real elevation. Nothing from Engineering Blueprint survives except the pieces
called out below as reused.

Explored and rejected during brainstorming (see session for full mockups): a literal
architectural-blueprint direction (dimension lines, "FIG. 01" annotations — read as gimmicky
prop rather than product), a circuit-schematic direction, a VS-Code-chrome direction, and a
Linear/Vercel-tier minimal SaaS direction (approved initially, then rejected as "generic" once
seen applied — centered-hero-stats-cards is the industry-default skeleton, not a distinctive
one). A phosphor-terminal direction was seriously considered and dropped in favor of the
option below, which tested better once colored and given depth.

## Direction: Session Console

The product's core moment is a live-scored mock interview — question, answer, real-time
feedback. Rather than a marketing headline sitting next to decorative brand art, the interview
transcript itself becomes the hero visual: an asymmetric split (not a centered column), with
a "live session" panel — question/answer chat bubbles, a scoring readout with a live dot
indicator — carrying equal or greater visual weight than the copy. This pattern (product-in-
action as hero, not headline+card) is the throughline that replaces Engineering Blueprint's
corner-bracket motif as the system's signature idea.

Tone: editorial-technical rather than corporate-SaaS or literal-blueprint — a serif face for
headings (borrowed from technical journals/papers, not marketing sans-serif), monospace for
data and system-style labels, warm dark surfaces with real elevation (layered gradients, soft
shadows, ambient glow) instead of flat hairline-bordered panels.

## Design tokens

**Color** — new accent, existing base ramp otherwise untouched:

- Background/surface/on-surface ramp stays as-is in both themes (no need to churn a working
  base a second time).
- New accent scale ("bronze"), replacing `--color-accent-warn` amber from the prior system:
  - Dark: `#e6a13d` (fills, numbers, glow), `#d9922e` (small text/dot/tag), `#c17f1f`
    (gradient shadow stop).
  - Light: `#a5641a` (single shade — smaller surface area than dark mode, one shade holds
    contrast on white/paper without a second tint).
  - **This accent is brand/UI chrome only** — nav dots, section-label tags, panel highlights,
    primary buttons, ambient glow. It must **not** be reused as a score-tier color. The
    existing 3-tier score semantic in `dashboard/page.tsx`'s `scoreBadgeClass` (`>=80` →
    primary/emerald, `>=60` → amber/tertiary, `<60` → error/red) stays exactly as-is
    everywhere scores are shown. This is a deliberate fix to a real risk raised during
    brainstorming: an all-purpose amber/bronze accent sitting next to a scoring system that
    also uses amber for "medium" would make a bronze-colored 91 read as a caution flag
    instead of a great result. Keeping them visually distinct (bronze = brand, existing
    green/amber/red = score meaning) resolves that.
  - Bronze rejected in favor of: literal orange (tested first, read too close to hazard/
    warning orange — same collision risk, worse); electric cyan (tested, read as generic
    tech-blue again).
- Ambient glow: large, soft `radial-gradient` using the accent at low opacity (`~6-10%`),
  positioned behind hero-type panels only. Dark mode: warm glow on near-black. Light mode:
  same technique at lower opacity against the paper background — translated, not inverted.
- Light-mode base shifts from the existing cool near-white to a warm paper tone (`#f7f4ee`)
  to match the editorial-serif tone. This is a real change to `--color-background`/
  `--color-surface` in light mode, not just an accent addition — implementation must re-check
  contrast on every existing color token that assumed a cooler background.
- Grain: subtle SVG-noise overlay (inline `data:` URI, `feTurbulence`, ~5% opacity), dark mode
  only, scoped to hero/marketing-type surfaces (never dense data pages — same reasoning as the
  prior system's grid-texture scoping: don't add visual noise on top of already-dense score
  tables). No new dependency — pure inline SVG.

**Elevation** — replaces Engineering Blueprint's hard-offset shadow scale entirely:

- Dark: panel background is a subtle top-to-bottom gradient (`#1b1c1f` → `#17181a`), 1px
  border (`#2c2d30`), soft blurred shadow (`0 20px 50px -12px rgba(0,0,0,.6), 0 2px 8px
  rgba(0,0,0,.4)`), plus a 1px inset top highlight for a lifted-glass-adjacent (but not
  blurred/glassmorphic) feel.
- Light: solid white panel, 1px warm-gray border (`#e3ddd0`), single soft shadow (`0 8px 20px
  -10px rgba(80,60,20,.15)`).
- **Radius reverts to soft/rounded** (~10-12px) — this explicitly undoes Engineering
  Blueprint's sharp-corner (`0.1875rem`) mandate. The sharp-corner look is judged to be part
  of what made the prior system feel like "borders changed, nothing else did"; elevation and
  depth are this system's replacement for that visual signal.

**Typography:**

- New serif for headings only: **Source Serif 4** (Google Fonts) — technical-journal
  register, distinct from every sans-serif SaaS default, full weight range, high legibility at
  display sizes. Replaces Hanken Grotesk as the heading face. Scope: page titles, section
  headings, role/prompt names in cards — never body copy, buttons, or nav.
- Body copy: existing Inter (`--font-sans`), unchanged — no reason to re-litigate a working
  choice.
- Data/system face: existing Geist Mono (`--font-mono`) from the prior system, kept and
  **scope expanded** — beyond just live numeric values (scores, timestamps, counters), it now
  also sets: section labels (`// SELECT MODE`, small-caps style via `text-transform`), tag/
  dot-indicator text, table column headers. Still never body prose or headings.

## Signature components

Replaces `.blueprint-card` / `.blueprint-nav` / `.blueprint-grid` in `app/globals.css`
entirely — these are new classes, not a rename:

- **`.panel`** — the elevated card (see Elevation above). This is the dominant layout unit,
  same role `.blueprint-card` played, used everywhere a card/section container currently
  exists.
- **`.tag`** — small mono-uppercase label with a colored dot (`•`), used for section labels
  (`LIVE MOCK SESSION`, `SELECT MODE`) and stat-tile headers. The dot color signals context:
  bronze accent for brand/neutral labels, semantic score colors when labeling a score.
- **`.bubble`** (`.bubble.q` / `.bubble.a`) — chat-style question/answer container. Used
  decoratively on the landing hero and **literally** as the actual interview transcript UI on
  the active-interview page — one visual pattern serving both marketing and product surfaces.
- **`.score-row`** — the live scoring readout: number + label + elapsed time, elevated above
  its parent panel slightly (`translateY`) with its own glow, used on the landing hero mock
  transcript and as the pattern the real live-scoring SSE UI on the interview page adopts.
- **`.stat-tile`** — `.tag` header + large mono tabular-number value. Replaces bare numbers
  used previously on dashboard/progress/leaderboard stat displays.
- **`.badge`** — score/status pill. Colors stay wired to the existing 3-tier score semantic
  (see Color above), not the new accent.
- **Glow + grain** are section-level background treatments (see Color above), not components
  with their own class per se — implementation applies them as background utilities on
  hero-type sections.

## Layout patterns by page type

- **Marketing/hero (landing)**: asymmetric split — live-session panel (bubbles + score-row)
  as the primary visual, editorial copy in a narrower column, no centered-hero-stats-cards
  skeleton. Ambient glow + grain behind the split.
- **Dense app pages** (dashboard, progress, leaderboard, questions, achievements, profile):
  `.stat-tile` row at the top, `.panel`-based sections below (mode-select cards, tables), data
  tables use `.badge` for score/status columns. No glow/grain — same density-first reasoning
  as the prior system's grid-texture scoping.
- **Interview/session pages**: the `.bubble`/`.score-row` pattern from the landing mock
  becomes the actual live UI — real question/answer transcript, real SSE-driven score-row
  updates. This is a bigger lift than a pure style pass on this page specifically, since the
  existing transcript UI isn't currently bubble-shaped; implementation plan should treat the
  interview page's structural change as its own task, not lumped in with a mechanical
  class-swap task like the rest.
- **Auth pages (login/signup)**: `.panel` treatment on the form card, serif for the welcome
  headline, otherwise structurally unchanged (already asymmetric split per existing layout).

## Explicitly out of scope

- No new npm/JS dependency — the only new asset is a Google Fonts `<link>` for Source Serif 4
  (same mechanism already used for Geist Mono). Grain texture is inline SVG, no library.
- No changes to SSE event handling, scoring logic, or any backend behavior — visual/CSS/
  component-styling layer only, same boundary as the prior system.
- No copy/content rewrites beyond what's needed to fit the new tag/label conventions — not a
  content strategy pass.
- Both themes are in scope (product owner explicitly chose to keep light mode rather than go
  dark-only) — light mode is a full translation of every token above, not an afterthought;
  implementation must verify contrast on the new warm-paper background specifically, since
  it's a base-color change, not just a new accent.

## Verification

Pure frontend/visual change — no unit-test coverage applies. Manual, in-browser verification
per this project's existing UI-change rule (`CLAUDE.md`):
- Every page checked in both light and dark theme against the new warm-paper/near-black bases.
- Responsive check at mobile/tablet/desktop — asymmetric split layouts (landing hero,
  interview transcript) are new and specifically need mobile-stacking verification since nothing
  like them existed in the prior system.
- Contrast check on the bronze accent against both new backgrounds, and on body/heading text
  against the new warm-paper light background.
- Interactive flows re-checked after restyling: nav/sidebar navigation, login/signup forms, CV
  upload, live interview flow (SSE score updates rendering correctly inside the new
  `.score-row`/`.bubble` pattern), results display.
