---
name: design-taste-frontend
description: Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the right design direction, and ships interfaces that do not look templated. Real design systems when applicable, audit-first on redesigns, strict pre-flight check.
disable-model-invocation: true
---

# tasteskill: Anti-Slop Frontend Skill

> Landing pages, portfolios, and redesigns. Not dashboards, not data tables, not multi-step product UI.
> Every rule below is **contextual**. None of it fires automatically. First read the brief, then pull only what fits.
> Detailed rules live in `references/` files. The pointers below are MANDATORY reads at the stated moments, not optional extras.

---

## 0. BRIEF INFERENCE (Read the Room Before Anything Else)

Before touching code or tweaking dials, **infer what the user actually wants**. Most LLM design output is bad because the model jumps to a default aesthetic instead of reading the room.

### 0.A Read these signals first
1. **Page kind** - landing (SaaS / consumer / agency / event), portfolio (dev / designer / creative studio), redesign (preserve vs overhaul), editorial / blog.
2. **Vibe words** the user used - "minimalist", "calm", "Linear-style", "Awwwards", "brutalist", "premium consumer", "Apple-y", "playful", "serious B2B", "editorial", "agency-y", "glassy", "dark tech".
3. **Reference signals** - URLs they linked, screenshots they pasted, products they named, brands they're competing with.
4. **Audience** - B2B procurement panel vs. design-conscious consumer vs. recruiter scanning a portfolio. The audience picks the aesthetic, not your taste.
5. **Brand assets that already exist** - logo, color, type, photography. For redesigns, these are starting material, not optional input (see `references/redesign.md`).
6. **Quiet constraints** - accessibility-first audiences, public-sector, regulated industries, trust-first commerce, kids' products. These constraints OVERRIDE aesthetic preference.

### 0.B Output a one-line "Design Read" before generating
Before any code, state in one line: **"Reading this as: \<page kind> for \<audience>, with a \<vibe> language, leaning toward \<design system or aesthetic family>."**

Example read: *"Reading this as: B2B SaaS landing for technical buyers, with a Linear-style minimalist language, leaning toward Tailwind utilities + Geist + restrained motion."*

### 0.C If the brief is ambiguous, ask one question, do not guess
Ask exactly **one** clarifying question - never a multi-question dump - and only when the design read genuinely diverges. Example: *"Should this feel closer to Linear-clean or Awwwards-experimental?"*

If you can confidently infer from context, **do not ask**. Just declare the design read and proceed.

### 0.D Anti-Default Discipline
Do not default to: AI-purple gradients, centered hero over dark mesh, three equal feature cards, generic glassmorphism on everything, infinite-loop micro-animations everywhere, Inter + slate-900. These are the LLM defaults. Reach past them deliberately based on the design read.

---

## 1. THE THREE DIALS (Core Configuration)

After the design read, set three dials. Every layout, motion, and density decision is gated by these.

* **`DESIGN_VARIANCE: 8`** - 1 = Perfect Symmetry, 10 = Artsy Chaos
* **`MOTION_INTENSITY: 6`** - 1 = Static, 10 = Cinematic / Physics
* **`VISUAL_DENSITY: 4`** - 1 = Art Gallery / Airy, 10 = Cockpit / Packed Data

**Baseline:** `8 / 6 / 4`. Use these unless the design read overrides them. Do not ask the user to edit this file - overrides happen conversationally.

### 1.A Dial Inference (design read → dial values)
| Signal | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| "minimalist / clean / calm / editorial / Linear-style" | 5-6 | 3-4 | 2-3 |
| "premium consumer / Apple-y / luxury / brand" | 7-8 | 5-7 | 3-4 |
| "playful / wild / Dribbble / Awwwards / experimental / agency" | 9-10 | 8-10 | 3-4 |
| "landing page / portfolio / marketing site (default)" | 7-9 | 6-8 | 3-5 |
| "trust-first / public-sector / regulated / accessibility-critical" | 3-4 | 2-3 | 4-5 |
| "redesign - preserve" | match existing | +1 | match existing |
| "redesign - overhaul" | +2 | +2 | match existing |

### 1.B Use-Case Presets
| Use case | VARIANCE | MOTION | DENSITY |
|---|---|---|---|
| Landing (SaaS, mainstream) | 7 | 6 | 4 |
| Landing (Agency / creative) | 9 | 8 | 3 |
| Landing (Premium consumer) | 7 | 6 | 3 |
| Portfolio (Designer / studio) | 8 | 7 | 3 |
| Portfolio (Developer) | 6 | 5 | 4 |
| Editorial / Blog | 6 | 4 | 3 |
| Public-sector service | 3 | 2 | 5 |
| Redesign - preserve | match | match+1 | match |
| Redesign - overhaul | +2 | +2 | match |

### 1.C How the Dials Drive Output
Use these (or user-overridden values) as global variables. Cross-references refer to these exact variable names - never invent aliases like `LAYOUT_VARIANCE` or `ANIM_LEVEL`. Full band-by-band dial definitions (what each 1-10 level means technically) are in `references/foundations.md`.

---

## 2. MANDATORY REFERENCE READS (Workflow)

Work through these in order. Each pointer is a hard gate: Read the file at that moment, before proceeding.

1. **Redesign brief?** Before anything else, Read `references/redesign.md` (mode detection, audit-first protocol, preservation rules, modernisation levers). Skip only for pure greenfield.
2. **After the design read, before picking the foundation:** Read `references/design-systems.md` (brief → design-system map, official packages vs aesthetics, install commands, canonical doc links, Apple Liquid Glass honest approximation).
3. **Before writing any code:** Read `references/architecture.md` (stack, RSC safety, state rules, icon libraries, emoji policy, breakpoints, dependency verification).
4. **Before designing sections (typography, color, layout, states, forms, images, copy):** Read `references/design-directives.md` (bias-correction directives: serif discipline, palette bans, hero/layout hard rules, image strategy, content density, quotes, theme lock). These are hard rules; failing any is shipping broken work.
5. **Before adding ANY animation or scroll behavior:** Read `references/motion.md` (context-aware proactivity, motion-must-be-motivated, canonical GSAP sticky-stack / horizontal-pan / Motion reveal skeletons, forbidden animation patterns).
6. **Before finalizing styling and motion:** Read `references/foundations.md` (performance and a11y guardrails, reduced motion, Core Web Vitals, z-index, dial technical definitions, dark mode protocol).
7. **While composing sections and copy:** Read `references/ai-tells.md` (forbidden patterns: visual, typography, layout, content, production-test tells, the complete em-dash ban). Every output is audited against it.
8. **When choosing section/interaction patterns:** Read `references/vocabulary.md` (pattern-name vocabulary: hero paradigms, nav, grids, cards, scroll animations, galleries, text effects, animation-library choice).
9. **When adding or using library blocks:** Read `references/block-library.md` (Block Library contract: file location, frontmatter schema, required body sections, discipline).

Never skip a gate because the file "was probably loaded before" in a different session. If it is not in context now, Read it now.

---

## 3. OUT OF SCOPE

This skill is NOT for:
* Dashboards / dense product UI / admin panels (use Fluent, Carbon, Atlassian, or Polaris from `references/design-systems.md`).
* Data tables (use TanStack Table or AG Grid).
* Multi-step forms / wizards (use Form-specific patterns; this skill won't make them better).
* Code editors (use Monaco / CodeMirror with their official skinning).
* Native mobile (use Apple HIG / Material directly).
* Realtime collab UIs (presence, cursors, OT-aware - different problem class).

If the brief is one of the above, **say so explicitly**, point to the right tool, and only apply this skill's marketing-page / about-page / landing-page parts to the surfaces where they apply.

---

## 4. FINAL PRE-FLIGHT CHECK (mandatory gate)

Before outputting ANY code, Read `references/preflight.md` and run its full checkbox matrix. This is the last filter and it is NOT optional: run every box, and if a single box cannot be honestly ticked, the output is not done. Fix it before delivering. Do not deliver from memory of the checklist; load the file and check box by box.

