# Frontend design — multi-skill pipeline (MANDATORY)

**Trigger:** any frontend/UI work — above all a **/goal building a project from a PRD whose scope includes a front**: the pipeline governs every UI the PRD produces, loaded before the first UI code, not as an afterthought.

**Premise:** one skill alone produces a templated, mediocre front. A magnificent front comes from **layering skills**, each owning one phase. Every frontend task runs the pipeline below and invokes **at least one skill per applicable phase — normally 3–5 skills total, never fewer than the per-task minimum**. Load each via the Skill tool *before* writing the matching code, not after.

**TRIVIAL-FIX EXCEPTION:** a pointed fix of ~10 lines or less inside an existing UI (typo, spacing tweak, broken class, one-prop change) skips the pipeline — global "judgment over ceremony" applies. Anything that designs or redesigns a component/page runs the full pipeline.

**AUTONOMOUS MODE (/goal from PRD):** the user is NOT in the loop — never pause to ask about design direction, palette, fonts, or layout. Every decision comes from the PRD; where the PRD is silent, this pipeline decides (Phase 0 default = `apple-design`, Phase 2.5 fundamentals fill the gaps). Ambiguity is resolved by the skills, not by a question. The deliverable is a finished, verified front the user sees on waking — Phase 5 evidence (screenshots, clean console, mobile + dark mode pass) replaces user review.

**HARD EXCEPTION — Design System projects:** if the project already defines its own Design System (tokens, components, style guide set by the user or repo), DO NOT use any skill in this section. Follow the existing Design System exactly. This whole pipeline applies only to projects with no predefined design language.

The skills split into lanes. **Aesthetic-direction skills CONFLICT** — mixing two visual languages = incoherent UI, so pick **exactly one**. **Craft / motion / review skills STACK** — use every one that applies. The point is not "run all 14"; it is "never build from a single skill" — one direction + several craft layers.

### Phase 0 — Direction: pick exactly ONE aesthetic
Defines the visual language. Choose by brief; do not combine.
- `apple-design` — **PRIORITY DEFAULT**: Apple-style fluid/physical motion, translucent materials, gesture-driven UI. Use unless the brief clearly calls for another direction below (also stacks in Phase 3 when only its motion guidance is needed)
- `high-end-visual-design` — premium agency look (marketing / landing / product)
- `minimalist-ui` — clean editorial, warm monochrome
- `industrial-brutalist-ui` — raw, mechanical, data-heavy dashboards
- `gpt-taste` — GSAP-driven editorial motion + bento grids

### Phase 1 — Visual reference FIRST (greenfield / high-visual pages)
Generate design references *before* coding. Skip only for small internal CRUD.
- `imagegen-frontend-web` — one reference image per landing section
- `imagegen-frontend-mobile` — mobile app screens / flows
- `image-to-code` — generate the design image, then match it in code
- `brandkit` — when a brand identity / logo system is needed

### Phase 2 — Build with taste (ALWAYS)
- `design-taste-frontend` — anti-slop default; infer direction, avoid templated output
- `stitch-design-taste` — when emitting a `DESIGN.md` / design-system semantics
- `tailwind-v4-shadcn` — ONLY if the project's stack is Tailwind v4 + shadcn/ui (per PRD or existing code); skip on any other stack

### Phase 2.5 — Fundamentals (STACK — apply every one the UI touches)
Craft layers that make any direction feel finished; they never conflict with Phase 0.
- `better-ui` — polish details: shadows, borders, optical alignment, hover states, micro-interactions
- `better-typography` — font pairing, type scale, line-height, truncation, variable fonts, text-wrap
- `better-colors` — OKLCH palettes, contrast, gamut, dark-mode tokens (any time you define colors, not defaults from a framework)

### Phase 3 — Motion + polish (ALWAYS for interactive UI)
- `transitions-dev` — product-motion catalog (badges, dropdowns, modals, page transitions, icon swaps, shimmer, accordions…); run `transitions apply` after components exist
- `emil-design-eng` — animation + polish philosophy, the invisible details
- `review-animations` — audit existing motion on a diff
- `improve-animations` — codebase-wide motion audit → prioritized plans (read-only; from [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/main/skills/improve-animations))
- `find-animation-opportunities` — sweep a UI for moments that don't animate but should, reject the rest → precise motion recipes (read-only; from [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/main/skills/find-animation-opportunities))
- `animation-vocabulary` — reverse-lookup: name a motion effect precisely before prompting/specifying it (utility, use as needed)

### Phase 4 — Review pass (ALWAYS, last)
- `impeccable` — UI/UX audit, polish, 23 commands; run before declaring the front done
- `redesign-existing-projects` — when upgrading an existing UI (audit-first; replaces Phase 0–1)

### Phase 5 — Visual verification (ALWAYS — no front is "done" untested in a browser)
Static review is not proof. Open the real page, look at it, fix what the pixels show.
- Harness browser pane (Claude Code) or `webapp-testing` / `agent-browser` — load the page, screenshot, test interactions, check console errors, verify responsive (mobile width) and dark mode
- Iterate: screenshot → fix visible issue → screenshot again. Declare done only on a clean pass.

### Minimum bar per front (never ship a front from one skill)
- **Greenfield visual page:** Phase 0 (1) + Phase 1 (1) + Phase 2 + Phase 2.5 + Phase 3 + Phase 4 + Phase 5 → ~6 skills.
- **Internal / CRUD UI:** Phase 0 (1) + Phase 2 + Phase 2.5 (as applicable) + Phase 4 + Phase 5 → 3–4 skills.
- **Redesign:** `redesign-existing-projects` + Phase 2 + Phase 2.5 + Phase 3 + Phase 4 + Phase 5.
