---
name: ui-polish
description: Build or improve a web UI (page, screen, component, flow, chart or dashboard) to a design-engineer craft bar on any stack, routing to the jakubkrehel, emilkowalski and MengTo reference skills and the craft concepts that agree with them. Use when asked to create a screen, component or data visualization from scratch or from a Figma file or design image, improve/polish/redesign an existing page ("improve the UI", "make the UI look better", "feels off"), up to every component on it, review UI or motion quality of a screen or of a diff/branch/PR, strip generic AI-design slop, add, fix or de-jank animations and gestures, pick a UI library, fix Sonner toasts, show variants, render every state of a component, or stress-test it with worst-case data. Skip for pure logic, data pipelines or backend work.
---

# UI polish

One router, stack-agnostic. The taste lives in the reference library; this file decides which reference to read, when, and how the work is verified. Reading a reference means loading the whole file, not a grep. No rule here needs a package to be applied.

The **project's design system is the direction**. Tokens, component library, density and motion language already in the repo win over anything a reference proposes. A reference supplies the rule and the exact value; the project supplies the idiom the fix is written in. Never introduce a second styling system, a parallel token set, or a new aesthetic to apply a rule.

## Reference library

`REFS` = `~/.claude/ui-refs` (Windows: `C:\Users\<user>\.claude\ui-refs`). Missing or stale → run `bash update-refs.sh` from the directory of this `SKILL.md` (clone-or-pull, idempotent; skills dirs differ per harness). It ends with two drift checks: `UNROUTED` names an upstream skill, a craft `references/` file or a craft draft that no file of this skill routes or excludes, `MISSING` names a `REFS/` path, or a bold section name, that a file of this skill cites and upstream no longer has. Either line is reported to the user as a follow-up and the task continues; the fix lands in the agent-dotfiles repo per its `AGENTS.md`, never in the installed copy of this skill. Every reference is a whole directory: `SKILL.md` is the rule set, sibling `.md` files hold the exact values.

The references stay upstream on purpose. Copying them into this skill would freeze a snapshot that drifts from every upstream update; this file holds only routing and procedure, so a pull is the whole refresh.

| Domain | Owner (read `SKILL.md` + siblings) |
| --- | --- |
| Accessibility: names, focus, keyboard, hit areas, reduced motion | `REFS/jakubkrehel-skills/skills/better-accessibility/` |
| Layout: grouping, alignment, reading order, breakpoints, growth | `REFS/jakubkrehel-skills/skills/better-layout/` |
| Writing: labels, errors, empty states, destructive flows, plurals, locale formatting | `REFS/jakubkrehel-skills/skills/better-writing/` (`patterns.md` has the templates) |
| Typography: scale, wrapping, tabular nums, truncation | `REFS/jakubkrehel-skills/skills/better-typography/` |
| Colors: tokens, ramps, measured contrast | `REFS/jakubkrehel-skills/skills/better-colors/` |
| Polish: concentric radius, optical alignment, surfaces, icons, enter/exit | `REFS/jakubkrehel-skills/skills/better-ui/` |
| Materials: translucent chrome, material weight, vibrancy, scroll edge effects, dim versus separate | `REFS/emilkowalski-skills/skills/apple-design/SKILL.md` (**Materials & depth**); `prefers-reduced-transparency` and vestibular triggers in its **Reduced motion & accessibility** |
| Motion bar: ten standards, escalation triggers, exact curves and durations | `REFS/emilkowalski-skills/skills/review-animations/` (`STANDARDS.md` has the values) |
| Motion build: the gate, then the decision order | `REFS/emilkowalski-skills/skills/animate/` (`RECIPES.md` has code) |
| Motion opportunities: where motion is missing, with restraint | `REFS/emilkowalski-skills/skills/find-animation-opportunities/SKILL.md` |
| Motion performance: frame budget, composite-only properties, CSS vs WAAPI vs rAF, `will-change`, jank diagnosis | `REFS/emilkowalski-skills/skills/animation-performance/SKILL.md` (causes in **Phase 2: Diagnose**, fixes in **The Symptom Table**) |
| Motion codebase audit: the hunt checklist across every animation in an app | `REFS/emilkowalski-skills/skills/improve-animations/` (`AUDIT.md` has the checklist; its plan flow and `PLAN-TEMPLATE.md` are replaced by [audit.md](audit.md) step 5) |
| Motion names: vague description to exact term ("the bouncy popover thing") | `REFS/emilkowalski-skills/skills/animation-vocabulary/SKILL.md` (**Glossary**) |
| Gesture and physical motion: 1:1 drag, interruptibility, velocity handoff, momentum, rubber-banding | `REFS/emilkowalski-skills/skills/apple-design/SKILL.md` (**Quick Reference** has the values; its Typography section yields to `better-typography`), plus `emil-design-eng/SKILL.md` **Gesture and Drag Interactions** for the web mechanics |
| React Native / Expo motion: threads, Reanimated, Gesture Handler, haptics, on-device stutter | `REFS/emilkowalski-skills/skills/animate-expo/` (`RECIPES.md` has code); when it applies is recon step 1 |
| Worst-case data: realistic break values, failure signatures, truncate vs wrap vs clamp | `REFS/emilkowalski-skills/skills/break-ui/` (`CATALOG.md` has the values) |
| Mobile feel: viewport, tap, safe areas, sticky hover | `REFS/emilkowalski-skills/skills/mobile-native/SKILL.md` |
| Library pick: curated list per task, charts included, hand-rolled mismatches | `REFS/emilkowalski-skills/skills/pick-ui-library/SKILL.md` (**Common mismatches to catch** is the review check) |
| Sonner toasts: setup, styling ladder, troubleshooting | `REFS/emilkowalski-skills/skills/ask-sonner/` (`API.md` has the props) |
| Design to code: Figma or image source, token mapping, deviation report | `REFS/jakubkrehel-skills/skills/build-design/` (`figma.md` has the MCP calls) |
| Component states: every state the code reaches, mock data at the data boundary, switcher | `REFS/jakubkrehel-skills/skills/state-machine/` (`switcher.md` has the spec) |
| Design exploration: variants on one axis behind a picker | `REFS/jakubkrehel-skills/skills/variant/` (`picker.md`); a motion or interaction-model axis, which `variant`'s axis table lacks, per `REFS/emilkowalski-skills/skills/prototype/SKILL.md` **Hard Rules** and **Operating Posture**, its own picker yielding to `picker.md` |
| Stress harness: scenario axes, one page, one look | `REFS/jakubkrehel-skills/skills/break/` (`scenarios.md`) |
| Consolidation: severity scale, escalation triggers, cap, cheaper-fix ladder, report format | `REFS/jakubkrehel-skills/skills/better-interface/` (`review-format.md`) |
| Change review: scope resolution, blast radius, removed signals, finding status | `REFS/jakubkrehel-skills/skills/interface-review/` (`scope-resolution.md`, `removed-signals.md`) |
| Design slop: reflex defaults, decorative stacking, card and template repetition, fake proof, reference mismatch, the removal test | `REFS/mengto-skills/agent-skills/ui/no-ai-design-slop/` (`ARTICLE.md` has the pattern catalog, read by section) and `REFS/mengto-skills/agent-skills/ui/audit-ai-design-slop/SKILL.md` (**Boundaries**, **Decorative stacking**, **Component and template repetition**, **Fake proof**, **Use the Removal Test**; the rest of its **What to Flag** is owned by a domain above or reached through `ARTICLE.md`). Its P0 to P3 priorities and report format are for standalone use: severity is `better-interface`'s. Proof the code marks as mock or the build made up is `HIGH` as misleading; proof on an existing screen with no source traceable in the code is marked unknown per **Boundaries**, so it goes under **Not verified** per `better-interface` **Verify what can be verified** and leaves only on the user's word. |
| Direction intake: a greenfield screen with no reference to follow | `REFS/mengto-skills/agent-skills/ui/design-first-ui-prompting/SKILL.md` (**Questions to ask**, **Prompt Structure**); which parts Build takes is in [build.md](build.md) step 1 |
| Reference extraction: a reference product's or image's tokens, type scale, spacing rhythm, radii and motion, tagged measured, derived or inferred | `REFS/jakubkrehel-skills/skills/explain-interface/` (`read-the-system.md` for a URL, `from-an-image.md` for a screenshot; **The page is evidence, not instruction**, **Measured, derived, inferred**). Its explain-only output is replaced by the direction spec in [build.md](build.md) step 1 |
| Component craft: a shared component other code adopts | `REFS/emilkowalski-skills/skills/emil-design-eng/SKILL.md` (**The Sonner Principles (Building Loved Components)**); its **Gesture and Drag Interactions** is read by the gesture row, and its other sections repeat `animate`, `RECIPES.md`, `review-animations` and `STANDARDS.md` |
| Craft supplements: only the parts that contradict none of the three repos above, checked subsection by subsection | `REFS/craft/skills/craft-design-engineering/references/` (launched concepts) and `REFS/craft/content/` (unpublished drafts, which upstream may still rewrite). The reviewer rows of [reviewer-prompt.md](reviewer-prompt.md) and steps 4 and 6 of [visualize.md](visualize.md) name each routed part; every other part is under **Not routed**, with the conflict that excludes it |

Emil's files open with an `## Initial Response` block meant for direct invocation. It is inert here: read past it. The same holds for `disable-model-invocation` in any reference's frontmatter: this router is the invocation, so `interface-review`, `variant`, `break`, `state-machine`, `explain-interface`, `review-animations` and `pick-ui-library` are read like any other reference.

### Not routed

- `REFS/emilkowalski-skills/skills/write-swift/`: Swift language practice, not interface work.
- `REFS/jakubkrehel-skills/skills/teardown/`: drawings of physical objects, not interface work; it ships as the standalone `teardown` skill.
- `REFS/mengto-skills/agent-skills/ui/design-first-ui-prompting/ARTICLE.md` and `demo/`: model and tool picks, template selling, and "craft signals" (numbered labels, beam animations) that `no-ai-design-slop` `ARTICLE.md` lists as slop. The router reads the skill's `SKILL.md` only.
- Sections no step reads, each covered elsewhere: `no-ai-design-slop` **Make motion explain something** (the `animate` gate), `no-ai-design-slop/ARTICLE.md` **Prompt Vocabulary** (phrasing for follow-up prompts; findings name problems in the owning domain's terms), and `design-first-ui-prompting` **Rules that improve consistency** and **Fast iteration checklist** (image-model prompting; its layout, hierarchy and copy first is Build's order).
- craft parts not routed, each with its reason. A part goes out when any sentence or snippet value in it contradicts any of the three repos, whichever one this router prefers in a tie:
  - `REFS/craft/skills/craft-design-engineering/SKILL.md`: the index of the launched concepts; its rule to prefer the site's exact values yields to the references.
  - `REFS/craft/skills/craft-design-engineering/references/typography.md`: **Tables** of **Tabular Numbers** right-aligns numbers, against better-layout's end alignment. The intro and Usage of **Optical Alignment** move the play icon left and nudge it 1px, against better-ui surfaces.md. **Buttons with icons** and **Optical sizes** repeat better-ui and better-typography. In **Font Smoothing**, the intro repeats better-typography, **Thin weights** accepts 300-weight body text against better-typography's weights, and **The other two values** with the region rule of its Usage break root-only smoothing.
  - `REFS/craft/skills/craft-design-engineering/references/color.md`: the **Noise** intro adds texture to a flat UI, the decoration audit-ai-design-slop flags. In **Image Outlines**, the intro and **How strong** tune the strength per mode against better-ui's fixed 10%, **Why not a border** offers an inset shadow in place of better-ui's outline, and its Usage outlines every image, transparent art included.
  - `REFS/craft/skills/craft-design-engineering/references/layout.md`: **Nested Border Radius** squares the inner corner with max() past the radius, against better-ui's own-radius rule past 24px, and otherwise repeats better-ui. **HTML Background** past **The document canvas**: the overscroll caution goes against mobile-native's app baseline, and theme-color repeats mobile-native. The Usage of **Scroll Fades** sets physical directions, against better-layout's logical properties.
  - `REFS/craft/skills/craft-design-engineering/references/motion.md`: **Button Press** past **Not just buttons** sets values against better-ui's 0.96 over 150ms, and its iOS touchstart note goes against mobile-native's :active on every input. In **Interruptibility** past **When others join in**, **Keep the momentum** prefers ease-out to springs against apple-design's springs for anything a user can touch, its Usage uses a curve outside the STANDARDS.md tokens and a spring that bounces against better-ui's bounce 0, and the rest repeats STANDARDS.md and apple-design. In **Hover Restraint** past **Tooltips**, **Keyboard actions** judges keyboard motion by frequency where animate disqualifies it, and the intro repeats STANDARDS.md.
  - Drafts with a conflict in every part that adds knowledge:
    - `REFS/craft/content/layout/clip-path.mdx`: a compositing claim against better-ui and animation-performance, and 300ms on the built-in ease-out STANDARDS.md calls too weak.
    - `REFS/craft/content/motion/exit-animations.mdx`: ease-in exits, against STANDARDS.md.
    - `REFS/craft/content/motion/scale-entrances.mdx`: the built-in ease-out, and no reduced-motion guard.
    - `REFS/craft/content/motion/stagger.mdx`: a 360ms entrance over the STANDARDS.md cap, and steps past 100ms called a wait, against better-ui's 100ms stagger.
    - `REFS/craft/content/typography/letter-spacing.mdx`: tracking values and a 10px label, off better-typography.
    - `REFS/craft/content/color/shadows-not-borders.mdx`: elevation and dark-mode rings, off better-ui surfaces.md.
    - `REFS/craft/content/craft/performance-is-design.mdx`: show nothing under 300ms and optimistic results, against the spinner better-accessibility forms.md shows while a submit runs. The spinner speed repeats emil-design-eng, and the caching fix is performance engineering.
  - Parts of routed drafts left out:
    - `REFS/craft/content/layout/hit-areas.mdx` past **Gaps are dead zones**: a 32px desktop floor, against better-accessibility's 40px. The rest repeats better-accessibility.
    - `REFS/craft/content/typography/icons.mdx` past **One set**: duotone icons, and regular weight beside medium text, against better-ui icons.md. **Size** repeats it.
    - `REFS/craft/content/typography/text-wrapping.mdx` past **Paragraphs**: balance on blockquotes and pretty on descriptions, against better-typography.
    - `REFS/craft/content/color/oklch.mdx` past **The three numbers**: one chroma curve for every hue and a flipped dark scale, against better-colors palette-generation.md. The gradients repeat it.
    - `REFS/craft/content/motion/icon-morph.mdx` past **When the shapes are related**: the claim that filter cannot be composited, against animation-performance, and an instant swap under reduced motion, against better-ui's cross-fade.
    - `REFS/craft/content/motion/shared-layout.mdx` past **Where it goes wrong**: a sliding tab indicator, against better-ui's instant tab feedback, and list-to-detail under 300ms, against the STANDARDS.md spring.
    - `REFS/craft/content/data/living-charts.mdx` past **Ranked lists** and the fixed y axis: a 900ms tween over the STANDARDS.md cap, and per-frame React state against animation-performance. The number rule repeats better-typography.
    - `REFS/craft/content/data/curve-smoothing.mdx`: its hand-rolled path helper. pick-ui-library's chart pick draws the curve.
    - `REFS/craft/content/sound/interface-sfx.mdx`: the hover whisper, against apple-design's sound for meaningful moments only.
  - Drafts with no interface rule of their own: `REFS/craft/content/motion/easings.mdx` repeats STANDARDS.md. `REFS/craft/content/craft/how-to-get-references.mdx` and `REFS/craft/content/craft/taste-is-trained.mdx` are practice essays. `REFS/craft/content/craft/timelessness.mdx` repeats no-ai-design-slop, and its restraint advice leans against it.
  - Sources of the launched concepts, which the router reads in the generated `references/` files instead: `REFS/craft/content/color/image-outlines.mdx`, `REFS/craft/content/color/noise.mdx`, `REFS/craft/content/layout/html-background.mdx`, `REFS/craft/content/layout/nested-border-radius.mdx`, `REFS/craft/content/layout/scroll-fades.mdx`, `REFS/craft/content/motion/button-press.mdx`, `REFS/craft/content/motion/hover-restraint.mdx`, `REFS/craft/content/motion/interruptibility.mdx`, `REFS/craft/content/typography/font-smoothing.mdx`, `REFS/craft/content/typography/optical-alignment.mdx`, `REFS/craft/content/typography/tabular-numbers.mdx`.
- `REFS/mengto-skills/agent-skills/ui/*/REFERENCES.md` and `agents/`: source link lists and a Codex manifest. The other `agent-skills/` categories are never checked out: `update-refs.sh` clones `agent-skills/ui` sparse.

## Step 0: Recon (every mode)

Before any reference is read, establish the project facts. They go into every subagent prompt and every fix.

1. **Stack and styling system**: framework, CSS approach, component library, motion library, chart library, from `package.json` and the root layout. React Native or Expo → `animate-expo` replaces `animate`, `animation-performance` and `mobile-native` everywhere in this skill (Build, Visualize, Motion and the motion reviewer), and the **mobile** trigger is off. Jank mode runs `animate-expo` **6. Keep it off the JS thread**, **Setup that silently breaks motion** and **120fps** in place of the `animation-performance` Workflow. The browser checks below do not reach a native screen: say so, and mark those checks Not verified.
2. **Tokens**: the global stylesheet (`globals.css`, theme file, Tailwind config). Note radius, spacing, easing, duration and color tokens by name.
3. **Shared components**: the project's own primitives (buttons, dialogs, tables, filters, charts, empty/error/loading states). A fix reuses them before adding markup.
4. **Project conventions**: `CONTRIBUTING.md`, `CODING_STANDARDS.md`, `AGENTS.md`, `CLAUDE.md`, a design-system doc, Storybook docs and interface ADRs; name which exist. Per `better-interface` **Recon before judgment**, a documented convention settles taste and is never itself a finding, but it never excuses an escalation trigger or a domain rule: that finding is reported once against the guideline or token that causes it. Hard tooling rules there (a banned library, a mandated wrapper) bind every fix.
5. **Supported viewports and personality**: mobile-first or desktop tool; playful product or crisp dashboard. Motion severity and density depend on it.
6. **Preview and gates**: the dev URL, login route if any, and the project's verification commands (typecheck, lint, test, lighthouse), and, before the first edit, the baseline every motion review diffs against: the SHA `git stash create` prints (`HEAD` when it prints nothing), plus `git status --porcelain` for untracked files.
7. **Conditional triggers**, one yes/no each, because each yes switches on a reviewer or a reference below:
   - **gesture**: the scope has drag, swipe, sheets, carousels, sliders, pull-to-refresh or spring-driven motion.
   - **mobile**: a phone viewport is supported.
   - **worst case**: the scope renders text or lists it does not author (user input, API data, CMS, translations).
   - **sonner**: `sonner` is in `package.json`.
   - **data viz**: the scope renders a chart or a KPI figure. A plain numeric table stays with typography and layout.

Write recon as a short block. It is the CONTEXT section of every reviewer prompt.

## Modes

Pick one from the request. State it in one line before starting, with the depth when the mode is Audit.

| Request shape | Mode | Procedure |
| --- | --- | --- |
| "Improve / polish / redesign this page or component", "it looks generic / AI-made" | **Audit** | [audit.md](audit.md) |
| "Review / audit this page or component" with no ask to change it | **Audit**, read-only | [audit.md](audit.md) steps 1 to 4, then the step 7 report with every row `open`: a review request edits nothing, per `better-interface` **Review without mutating by default**. The fixes run only when the user asks for them. |
| "Create / build this screen, flow, component or dashboard" | **Build** | [build.md](build.md) |
| "Build this from the Figma / this mockup / this screenshot" | **Design** | Read `build-design/SKILL.md` and `figma.md`, and follow its five steps: the design decides, every value maps to a project token. Before its **Report and stop**, run [audit.md](audit.md) steps 1 to 4 on the build, at the frames' widths and over every state the code reaches (step 2 is build-design's comparison screenshots, one per frame width). Sort each kept finding into `build-design`'s report: the design breaks a rule → **Domain conflicts**, with its owner; a state the design does not draw → **Missing states**; anything else is outside the piece and dropped. Apply none without the user's word. |
| "Visualize this data" / "a chart / KPI for X" in an existing screen | **Visualize** | [visualize.md](visualize.md). A whole new screen of charts is Build, which runs visualize.md for its chart parts. |
| "Which library for toasts / charts / drag-and-drop / OTP / ⌘K..." | **Library** | Read `pick-ui-library/SKILL.md`. Check `package.json` before recommending; reuse what is installed. The pick is Sonner → wire it per `ask-sonner/SKILL.md`. |
| "Toasts appear twice / sit behind the modal / ignore dark mode", Sonner setup or styling | **Toast** | Read `ask-sonner/SKILL.md`; `API.md` for an exact prop. Styling follows its escalation ladder, in the project's tokens. |
| "Animate X" / "add motion" / "this feels static" / "what could animate here?" | **Motion** | [motion.md](motion.md): `find-animation-opportunities` sweeps a scope with no named target, `animate` builds what survives its gate, a fresh `review-animations` reviewer approves or blocks. Zero lines is a valid outcome. |
| "This animation stutters / drops frames / is janky" | **Jank** | Read `animation-performance/SKILL.md` and run its **Workflow** through the Phase 3 report: what animates, the cause from **Phase 2: Diagnose**, the fix from **The Symptom Table**, and the Verified field. The user asked for smooth motion, so that request is the "when asked": apply the fixes, each naming its cause. A performance trace (`chrome-devtools-axi`) under CPU throttle is partial evidence only; a finding it cannot settle stays "needs a device recording". |
| "Show me options for this UI" | **Variant** | Read `variant/SKILL.md` + `picker.md`: three variants, each a different position on one primary axis, behind a picker on the real page. Also read the owner skill its axis table names for the chosen axis. A motion or interaction-model axis comes from `prototype`, and every variant that moves clears `animate` **Never Ship**, the motion bar `prototype` **Operating Posture** sets. The promoted variant is built properly and then runs the review gate ([audit.md](audit.md) step 6). |
| "Show every state of this component" / "I want to work on its loading/empty/error looks" | **States** | Read `state-machine/SKILL.md` + `switcher.md` and follow it: a throwaway page, mock data at the data boundary, a grouped switcher, handed over and left up until the user says done. |
| "Stress-test this component" / "try the worst case" | **Break** | [break.md](break.md): jakubkrehel `break` harness filled with emilkowalski `break-ui` worst-case values. |
| "Review this diff / branch / PR / my uncommitted changes" | **Change** | [change.md](change.md). Read-only; fixes only when the user asks. |

Audit, Build and Visualize all end with the **review gate** in [audit.md](audit.md); Build and Visualize reach it after the screen exists. Change reaches it only when the user asks for the fixes. Motion ends with its own review in [motion.md](motion.md) step 3.

## Depth

Audit runs at one of three depths. Read the depth from the request; default is `standard`.

| Depth | Request shape | Reviewers | Rounds |
| --- | --- | --- | --- |
| `quick` | "quick pass", "just the obvious" | accessibility, polish, motion, plus slop when the request calls the UI generic or AI-made; conditional ones only when the request names them | 1 |
| `standard` | any other improve request | the default set plus every conditional reviewer recon switched on | 1 |
| `exhaustive` | "ao máximo", "everything", "every component", "make it as good as it can be" | `standard`, with the inventory, apply policy and rounds per [audit.md](audit.md) **Exhaustive** | until a round has no HIGH or MEDIUM and nothing carried, at most 3 |

## Domain reviewers (fan-out)

A review of a screen runs one read-only subagent per domain, in parallel, each holding only its own reference. The main thread never reviews the domains inline: that thins attention and fills context with reference text.

- Prompt template: [reviewer-prompt.md](reviewer-prompt.md). Fill TASK, CONTEXT (recon block, scope files, preview URL) and the domain's reference paths.
- Default set: accessibility, layout, writing, typography, colors, polish, motion, slop (eight).
- Conditional set, added per recon step 7: **worst case** → worst-case reviewer; **gesture** → gesture reviewer; **mobile** → mobile reviewer; **data viz** → data-viz reviewer; **sonner** → the polish reviewer also reads `ask-sonner/SKILL.md` and `API.md`.
- Subagent type `general-purpose` in Claude Code, or the harness's equivalent read-only worker. Reviewers return findings only, no edits.
- A domain whose reference is missing on disk is `Not reviewed`, named in the report. Never rebuild its rules from memory or hand it to a neighbour.
- Consolidation stays in the main thread: read `better-interface/SKILL.md` (**Evidence, not taste**, **Use domain skills as the sources of truth**, **Verify what can be verified**, **Require evidence**, **Rank by user impact**, **Prefer the cheaper fix**, **Consolidate systemic findings**) and `review-format.md`, then merge to one ranked table under its severity scale, its cap of 15, and its cheaper-fix ladder (delete, platform, reuse, correct value, add). A finding two reviewers both return goes to the owner of the underlying rule, with the side effects in its **Why** cell. Re-read the cited line of every finding before keeping it.

## Evidence

Every finding and every claim of improvement cites `path:line` and, where rendering decides it, a browser observation. The browser on this machine is `chrome-devtools-axi` (`open`, `snapshot`, `screenshot`, `eval`, `console`); read `chrome-devtools-axi <command> --help` before use.

Minimum browser pass for a screen: screenshot at desktop width and at 320px, one at 200% zoom, `snapshot` for accessible names and focus order, one keyboard walk of the primary flow, and `prefers-reduced-motion` emulated once when motion exists. Add the RTL mirror always and the dark appearance when the project has one (`better-layout` and `better-colors` **Reporting**). A check that cannot run is reported as **Not verified**, never inferred.

## Before you finish

| Mistake | Fix |
| --- | --- |
| A fix written in a new styling idiom or a new token | Rewrite it with the project's tokens and components from recon |
| Domain reports pasted one after another | One consolidated table in the `better-interface` format |
| Finding kept from a subagent without re-reading the line | Open the file at the cited line; drop what does not reproduce |
| A gradient, glow, card, eyebrow, icon tile or section kept because it looks premium | Run `audit-ai-design-slop` **Use the Removal Test**; it stays only with a named job for this product |
| A metric, logo, testimonial, avatar or chart invented to fill a section | Real data, or a placeholder that reads as one, per `no-ai-design-slop` **Make the product specific** |
| Motion added because it looked nice | Run `animate`'s gate; delete motion on high-frequency or keyboard paths |
| Motion shipped on the author's own read of the diff | Dispatch the motion reviewer per [motion.md](motion.md) step 3 (audit step 6.3 in Audit, Build and Visualize) and close on its Verdict line |
| Drag, flick or sheet tuned with a duration and a curve | The spring from `review-animations/STANDARDS.md` **Springs**, with the velocity handoff, projection and rubber-band of `apple-design` **Quick Reference** |
| Jank "fixed" with `will-change` alone | Name the cause from `animation-performance` **Phase 2: Diagnose**; swap the property or move the work off the main thread first |
| Demo data only, or an invented worst case (`aaaa…`) | Values from `break-ui/CATALOG.md` or the schema limit |
| A recon step 7 trigger was yes but its reviewer never ran | Dispatch it, or name it `Not reviewed` in the report |
| `exhaustive` asked, one round of 15 delivered | Run the next round per **Exhaustive** in [audit.md](audit.md) until its stop condition |
| A component on the inventory with no reviewer verdict | Re-dispatch for it, or list it as Not reviewed |
| A chart styled with the library's default palette or font | Series colors and type from the project's tokens per [visualize.md](visualize.md) |
| A Figma value hit with an arbitrary utility or a raw hex | Map it to a token per `build-design`, or ask when rounding shows |
| A review-only request answered with edits | Revert them; report the table and wait for the user to ask for the fixes |
| "Improved" claimed from source alone | Before/after screenshot, or mark Not verified |
| Project gates skipped after edits | Run the recon step 6 commands and report their output |
| `update-refs.sh` printed `UNROUTED` or `MISSING` and nobody heard | Name each line to the user as a follow-up for the agent-dotfiles repo |
