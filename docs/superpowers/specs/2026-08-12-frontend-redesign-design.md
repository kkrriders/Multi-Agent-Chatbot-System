# Frontend Redesign — "Engineering Blueprint" Design System

**Date:** 2026-08-12
**Status:** Approved, ready for implementation planning

## Context

MockPrep's frontend (`frontend/`, Next.js 15 App Router) currently uses a "Luminous
Intelligence" design system: dark navy base, glassmorphic blur cards (`.glass-card` /
`.glass-nav` in `app/globals.css`), Inter body font, Hanken Grotesk headings. It has had
several rounds of polish (spacing, responsiveness, a glass-card `isolation` fix for a
backdrop-filter rendering bug in `f6ecad8`, BorderBeam integration on the landing page).

The product owner wants a full visual redesign — not an iteration on the current look, but
a new direction — across all ~12 pages and shared chrome. Target audience is candidates
prepping for (often technical/CS) interviews; the desired tone is **technical and precise**,
which should read as competence and rigor rather than coldness, since the product's job is
coaching people through interview stress.

## Direction: Engineering Blueprint

A HUD/technical-drafting aesthetic: corner-bracket cards (viewfinder-style L-marks instead
of full glass panels), a subtle graph-paper grid on hero surfaces, monospace numerals for
anything measurement-like (scores, timestamps, question indices), and a disciplined
two-accent palette (blue + amber) on the existing dark-navy base. This replaces glassmorphism
entirely — flat surfaces, hairline borders, sharp corners — rather than layering on top of it.

Dropping `backdrop-filter` blur also removes the rendering-bug class that `f6ecad8` had to
patch around (adjacent blurred cards merging into one GPU compositor layer). This is a
side effect of the visual change, not a separate initiative.

## Design tokens

**Color** (`app/globals.css` `@theme` block + `.dark` overrides):
- Keep `--color-background`, `--color-primary` (blue) and the existing surface/on-surface
  ramp as-is in both themes — they're already coherent, no need to churn a working base.
- Add an amber accent (`#f59e0b` light-mode-safe / `#fbbf24` dark) as a new token
  (`--color-accent-warn` or similar — exact name decided during implementation) used only
  for: corner brackets, blueprint-style annotations, active/highlighted metric values, and
  the BorderBeam trace on the landing CTA.
- Existing teal (`--color-tertiary`) is left wired to whatever semantic (success/positive)
  states already reference it — not touched unless implementation finds it's unused.
- Light mode gets the same corner-bracket/grid treatment with a pale grid line color — not
  abandoned, but dark remains the primary/default showcase theme (`defaultTheme="system"`
  in `theme-provider` is unchanged).

**Radius:** `--radius` drops from `0.5rem` (8px) to `0.125rem`–`0.25rem` (2-4px) globally.

**Typography:**
- Inter (body) and Hanken Grotesk (headings) are kept unchanged — both already work.
- Add a monospace face — Geist Mono (the project already loads a `Geist` Google Fonts
  family in `layout.tsx` for `--font-geist`, currently underused; swap it for the mono
  weight, or add Geist Mono explicitly if the non-mono `Geist` family doesn't ship a mono
  variant under that name).
- Monospace is scoped to: scores/percentages, timestamps, nav item indices, badge labels,
  question counters (e.g. `Q 03/12`). Never used for body prose or headings.

## Signature component: blueprint card

Replaces `.glass-card` and `.glass-nav` in `app/globals.css`. New `.blueprint-card`:
- Flat `--color-surface-container` background, no `backdrop-filter`.
- 1px hairline border in `--color-outline-variant`.
- Four small L-shaped corner brackets (accent-colored) at the card's corners, done via
  `::before`/`::after` pseudo-elements or an inline SVG — implementation's call.
- Sharp corners at the new global `--radius`.
- No box-shadow blur bloom; at most a 1px hard offset shadow if depth is needed.

Every existing usage of `.glass-card` / `.glass-nav` across all pages and components
(`nav.tsx`, `sidebar.tsx`, `Topbar.tsx`, and every page under `app/`) is migrated to this
new class as part of the rollout — this is the highest-leverage single change since cards
are the dominant layout unit on nearly every page.

## Texture & motion

- Graph-paper grid background (CSS `linear-gradient` or `background-image`, ~32-48px unit,
  low opacity ~4-8%) applied to hero/section-level backgrounds only (landing page hero,
  page-level headers) — explicitly **not** inside dense card grids (dashboard, progress,
  leaderboard) to avoid visual noise where information density is already high.
- Motion: 150-200ms, ease-out, no bounce/spring easing anywhere. Existing `transition`
  rule in `globals.css` `@layer base * { ... }` stays but duration/easing gets tightened
  to match.
- `BorderBeam` (`components/ui/border-beam.tsx`) usage stays scoped to the landing page's
  primary CTA only (per existing `CLAUDE.md` rule: animation stays on marketing surfaces,
  dashboard/interview/results stay calm). Recolor its gradient to the new amber accent.

## Rollout sequence

1. **Foundation:** land the token changes (`globals.css`), the new monospace font wiring
   (`layout.tsx`), and the `.blueprint-card` component definition.
2. **Anchor pages:** apply the new system to landing (`app/page.tsx`), dashboard
   (`app/dashboard/page.tsx`), and the active interview page
   (`app/interview/[sessionId]/page.tsx` or `app/interview/page.tsx` — implementation
   confirms current routing) to prove the system holds up on both a marketing page and
   dense product UI.
3. **Full rollout:** apply the same primitives to every remaining page — login, signup,
   upload, progress, leaderboard, questions, achievements, profile, results — plus shared
   chrome (`nav.tsx`, `sidebar.tsx`, `Topbar.tsx`, `GuestLimitPrompt.tsx`,
   `theme-provider.tsx` if it needs default-theme tweaks).
4. No page is left on the old glassmorphic system at the end of this pass — "everything in
   one shot" per product owner's explicit choice, not a phased/partial rollout.

## Explicitly out of scope

- No new UI component library — shadcn (structural) and MagicUI (`motion`-based flourishes)
  remain the only sources, per existing `CLAUDE.md` rule.
- No changes to SSE event handling, interview logic, scoring, or any backend behavior —
  visual/CSS/component-styling layer only.
- No copy/content rewrites beyond what's needed to fit new label conventions (e.g.
  `Q 03/12` counters) — not a content strategy pass.
- Accessibility must not regress: hairline borders and corner brackets must maintain
  sufficient contrast in both themes; monospace numerals must stay legible at body text
  sizes. This is a constraint on the above, not new scope.

## Verification

Pure frontend/visual change — no unit-test coverage applies. Verification is manual,
in-browser, per this project's existing UI-change rule (`CLAUDE.md`: "start the dev server
and use the feature in a browser before reporting complete"):
- Every page checked in both light and dark theme.
- Responsive check at mobile/tablet/desktop breakpoints (several pages already have
  responsiveness fixes from prior commits — must not regress those).
- Interactive flows re-checked after restyling: nav/sidebar navigation, login/signup forms,
  CV upload, live interview flow (SSE score updates, timer), results display — styling
  changes must not break any of these, only their appearance changes.
