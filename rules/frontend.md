# Frontend design — ordered skill flow (MANDATORY)

**Trigger:** any frontend/UI work — above all a **/goal building a project from a PRD whose scope includes a front**: the flow governs every UI the PRD produces, loaded before the first UI code, not as an afterthought.

**Premise:** one skill alone produces a templated, mediocre front. A magnificent front comes from **running skills in the right order**, each owning one step. Load each via the Skill tool *before* writing the matching code, not after. Normally 4–6 skills per front; never fewer than the minimum bar.

**TRIVIAL-FIX EXCEPTION:** a pointed fix of ~10 lines or less inside an existing UI (typo, spacing tweak, broken class, one-prop change) skips the flow — global "judgment over ceremony" applies. Anything that designs or redesigns a component/page runs the full flow.

**HARD EXCEPTION — Design System projects:** if the project already defines its own Design System (tokens, components, style guide set by the user or repo), DO NOT use any skill in this section. Follow the existing Design System exactly. This whole flow applies only to projects with no predefined design language.

**AUTONOMOUS MODE (/goal from PRD):** the user is NOT in the loop — never pause to ask about design direction, palette, fonts, or layout. Every decision comes from the PRD; where the PRD is silent, this flow decides (step 1 default = `apple-design`, step 3 fundamentals fill the gaps). Ambiguity is resolved by the skills, not by a question. The deliverable is a finished, verified front the user sees on waking — step 8 evidence (screenshots, clean console, mobile + dark mode pass) replaces user review.

**Redesign of an existing UI:** `redesign-existing-projects` replaces steps 1–2 (audit-first, don't rewrite from scratch, don't migrate frameworks). Do not also run design-taste-frontend's own redesign flow — two audit-first flows fight each other. Continue from step 3.

## The flow — run the steps in this order

### 1. Direction — pick exactly ONE aesthetic (conflict lane)
Aesthetic-direction skills define the visual language and CONFLICT with each other — mixing two visual languages = incoherent UI. Choose by brief; do not combine:

| Brief | Skill |
|---|---|
| Default — no clear signal otherwise | `apple-design` (fluid/physical motion, translucent materials; its motion guidance also feeds step 6) |
| Premium marketing / landing / product page | `high-end-visual-design` |
| Clean editorial, warm monochrome | `minimalist-ui` |
| Raw, mechanical, data-heavy dashboard | `industrial-brutalist-ui` |
| Awwwards-style GSAP editorial motion | `gpt-taste` — ONLY if adding the real GSAP dependency (`@gsap/react` + ScrollTrigger) is acceptable |

### 2. Visual reference (greenfield / high-visual pages only)
Generate design references *before* coding — skip for internal CRUD:
- `imagegen-frontend-web` — one reference image per landing section
- `imagegen-frontend-mobile` — mobile app screens / flows
- `image-to-code` — image-first build: generate the section images, then match them in code (subsumes the imagegen step — use it *instead of*, not after, `imagegen-frontend-web`)
- `brandkit` — only when a brand identity / logo system is needed

### 3. Foundations — tokens BEFORE components (stack lane)
Define the design tokens before building on them; retrofitting palette/type onto finished components is rework:
- `better-colors` — OKLCH palette, contrast, dark-mode tokens (any time you define colors — never framework defaults)
- `better-typography` — font pairing, type scale, line-height (match the project's existing styling system; never introduce a second one)

### 4. Build — pick by UI type
- **Landing / portfolio / marketing site** → `design-taste-frontend` (the skill refuses dashboards, data tables, wizards, editors, native mobile)
- **Product UI** (dashboard, CRUD, forms, app screens) → `impeccable` as build guidance; run its `scripts/context.mjs` first (bootstraps PRODUCT.md/DESIGN.md)
- `tailwind-v4-shadcn` — stack layer, ONLY if the project is Tailwind v4 + shadcn/ui (per PRD or existing code)

### 5. Component polish (stack lane)
- `better-ui` — shadows, borders, optical alignment, hit areas, press states, micro-interaction values
- `emil-design-eng` — the invisible-details philosophy; stack it while polishing, it never conflicts with step 1

### 6. Build-time motion
- `transitions-dev` — the product-motion catalog, 27 snippets (modals, dropdowns, accordions, shimmer, icon swaps, toasts, like buttons, checkboxes, spinning counters, toggles…); run `transitions apply` after components exist. Every snippet ships reduced-motion; don't pull a motion library for what the catalog covers.
- **Install its `_root.css` once** when the first snippet lands — it leads with the shared motion-token scale (`--duration-*`, `--ease-*`, `--distance-*`, `--scale-*`, `--blur-*`). Any *custom* motion written outside the catalog references these tokens from the start (`var(--duration-fast) var(--ease-smooth-out)`), never fresh hardcoded values — one motion grid for the whole front, and step 7's polish pass becomes a confirmation instead of a cleanup.

### 7. Motion sweep — the Emil loop (SEQUENTIAL, after the UI exists)
Restraint first: motion earns its place, and a static answer is a valid outcome.
1. `find-animation-opportunities` — shield framing: "is there anything here that should animate at all?" Scope it per view, not per app, and state usage frequency ("checkout, a few times per session") — frequency changes what deserves motion. Any freshly built page with zero motion gets this pass. Expect rejections; the "Rejected candidates" section is the point.
2. Top suggestion(s) → `improve-animations` — turns them into self-contained implementation plans (read-only; plans land under `plans/`). Don't implement from the sweep directly.
3. Implement the plans (step 6 catalog first, custom motion only where the plan demands it).
4. `transitions-polish` — token-grid tuning pass over ALL motion now in the project (catalog, custom, pre-existing): `transitions review` to audit, then `transitions polish` to apply the accepted lines. This is where motion goes from "works" to "feels expensive": open/close asymmetry (close faster than open; overshoot on entrances only, never bounce a close), hover-out softer/springier than hover-in, stagger totals under ~300ms, dismissals never delayed, every duration/easing/distance matched to its usage token. Mandatory whenever motion was written or touched in this front; it tunes values only, never swaps whole recipes (that's step 6).
5. `review-animations` — diff review of the implemented motion. Manual-only (`disable-model-invocation`); run when the user asks for a motion review.

### 8. Review gate + visual verification (ALWAYS, last)
Static review is not proof. In order:
1. `impeccable` — UI/UX audit before declaring the front done (same `context.mjs` bootstrap as step 4).
2. `react-doctor` — React/Next only: `npx react-doctor@latest --verbose --scope changed` (lint, a11y, bundle, architecture; `@latest` self-updates).
3. **Browser pass** — harness browser pane, `agent-browser`, or `webapp-testing`: load the real page, screenshot, test interactions, check console errors, verify mobile width + dark mode. Iterate screenshot → fix → screenshot; done only on a clean pass.
4. **Lighthouse on any page a user actually loads** (landing, marketing, public product page): `npx lighthouse@latest <url> --quiet --chrome-flags="--headless" --output=json --output-path=stdout`. Report the four scores; a red Performance or Accessibility score is a bug, not a nice-to-have. Skip for internal CRUD behind auth.

## Minimum bar per front (never ship a front from one skill)
- **Greenfield visual page:** steps 1 + 2 + 3 + 4 + 6 + 7 + 8 → ~6 skills.
- **Internal / CRUD UI:** steps 1 + 3 + 4 (impeccable) + 8 → 3–4 skills.
- **Redesign:** `redesign-existing-projects` + steps 3–8.
