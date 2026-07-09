# Frontend design — multi-skill pipeline (MANDATORY)

**Premise:** one skill alone produces a templated, mediocre front. A magnificent front comes from **layering skills**, each owning one phase. Every frontend task runs the pipeline below and invokes **at least one skill per applicable phase — normally 3–5 skills total, never fewer than the per-task minimum**. Load each via the Skill tool *before* writing the matching code, not after.

**TRIVIAL-FIX EXCEPTION:** a pointed fix of ~10 lines or less inside an existing UI (typo, spacing tweak, broken class, one-prop change) skips the pipeline — global "judgment over ceremony" applies. Anything that designs or redesigns a component/page runs the full pipeline.

**HARD EXCEPTION — Design System projects:** if the project already defines its own Design System (tokens, components, style guide set by the user or repo), DO NOT use any skill in this section. Follow the existing Design System exactly. This whole pipeline applies only to projects with no predefined design language.

The skills split into lanes. **Aesthetic-direction skills CONFLICT** — mixing two visual languages = incoherent UI, so pick **exactly one**. **Craft / motion / review skills STACK** — use every one that applies. The point is not "run all 14"; it is "never build from a single skill" — one direction + several craft layers.

### Phase 0 — Direction: pick exactly ONE aesthetic
Defines the visual language. Choose by brief; do not combine.
- `high-end-visual-design` — premium agency look (default for marketing / landing / product)
- `minimalist-ui` — clean editorial, warm monochrome
- `industrial-brutalist-ui` — raw, mechanical, data-heavy dashboards
- `gpt-taste` — GSAP-driven editorial motion + bento grids
- `apple-design` — Apple-style fluid/physical motion, translucent materials, gesture-driven UI (also stacks in Phase 3 when only its motion guidance is needed)

### Phase 1 — Visual reference FIRST (greenfield / high-visual pages)
Generate design references *before* coding. Skip only for small internal CRUD.
- `imagegen-frontend-web` — one reference image per landing section
- `imagegen-frontend-mobile` — mobile app screens / flows
- `image-to-code` — generate the design image, then match it in code
- `brandkit` — when a brand identity / logo system is needed

### Phase 2 — Build with taste (ALWAYS)
- `design-taste-frontend` — anti-slop default; infer direction, avoid templated output
- `stitch-design-taste` — when emitting a `DESIGN.md` / design-system semantics

### Phase 3 — Motion + polish (ALWAYS for interactive UI)
- `transitions-dev` — product-motion catalog (badges, dropdowns, modals, page transitions, icon swaps, shimmer, accordions…); run `transitions apply` after components exist
- `emil-design-eng` — animation + polish philosophy, the invisible details
- `review-animations` — audit existing motion
- `animation-vocabulary` — reverse-lookup: name a motion effect precisely before prompting/specifying it (utility, use as needed)

### Phase 4 — Review pass (ALWAYS, last)
- `impeccable` — UI/UX audit, polish, 23 commands; run before declaring the front done
- `redesign-existing-projects` — when upgrading an existing UI (audit-first; replaces Phase 0–1)

### Minimum bar per front (never ship a front from one skill)
- **Greenfield visual page:** Phase 0 (1) + Phase 1 (1) + Phase 2 + Phase 3 + Phase 4 → ~5 skills.
- **Internal / CRUD UI:** Phase 0 (1) + Phase 2 + Phase 4 → 3 skills.
- **Redesign:** `redesign-existing-projects` + Phase 2 + Phase 3 + Phase 4.
