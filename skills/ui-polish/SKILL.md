---
name: ui-polish
description: Build or improve a web UI (page, screen, component, flow, chart or dashboard) to a design-engineer craft bar on any stack, routing to the jakubkrehel and emilkowalski reference skills. Use when asked to create a screen, component or data visualization from scratch or from a Figma file or design image, improve/polish/redesign an existing page ("improve the UI", "make the UI look better", "feels off"), up to every component on it, review UI or motion quality of a screen or of a diff/branch/PR, add, fix or de-jank animations and gestures, pick a UI library, fix Sonner toasts, show variants, render every state of a component, or stress-test it with worst-case data. Skip for pure logic, data pipelines or backend work.
---

# UI polish

One router, stack-agnostic. The taste lives in the reference library; this file decides which reference to read, when, and how the work is verified. Reading a reference means loading the whole file, not a grep. No rule here needs a package to be applied.

The **project's design system is the direction**. Tokens, component library, density and motion language already in the repo win over anything a reference proposes. A reference supplies the rule and the exact value; the project supplies the idiom the fix is written in. Never introduce a second styling system, a parallel token set, or a new aesthetic to apply a rule.

## Reference library

`REFS` = `~/.claude/ui-refs` (Windows: `C:\Users\<user>\.claude\ui-refs`). Missing or stale → run `bash update-refs.sh` from the directory of this `SKILL.md` (clone-or-pull, idempotent; skills dirs differ per harness). It ends with two drift checks: `UNROUTED` names an upstream skill this table neither routes nor excludes, `MISSING` names a `REFS/` path a file of this skill cites that upstream no longer has. Either line is reported to the user as a follow-up and the task continues; the fix lands in the agent-dotfiles repo per its `AGENTS.md`, never in the installed copy of this skill. Every reference is a whole directory: `SKILL.md` is the rule set, sibling `.md` files hold the exact values.

The references stay upstream on purpose. Copying them into this skill would freeze a snapshot that drifts from every upstream update; this file holds only routing and procedure, so a pull is the whole refresh.

| Domain | Owner (read `SKILL.md` + siblings) |
| --- | --- |
| Accessibility: names, focus, keyboard, hit areas, reduced motion | `REFS/jakubkrehel-skills/skills/better-accessibility/` |
| Layout: grouping, alignment, reading order, breakpoints, growth | `REFS/jakubkrehel-skills/skills/better-layout/` |
| Writing: labels, errors, empty states, destructive flows, plurals, locale formatting | `REFS/jakubkrehel-skills/skills/better-writing/` (`patterns.md` has the templates) |
| Typography: scale, wrapping, tabular nums, truncation | `REFS/jakubkrehel-skills/skills/better-typography/` |
| Colors: tokens, ramps, measured contrast | `REFS/jakubkrehel-skills/skills/better-colors/` |
| Polish: concentric radius, optical alignment, surfaces, icons, enter/exit | `REFS/jakubkrehel-skills/skills/better-ui/` |
| Motion bar: ten standards, escalation triggers, exact curves and durations | `REFS/emilkowalski-skills/skills/review-animations/` (`STANDARDS.md` has the values) |
| Motion build: the gate, then the decision order | `REFS/emilkowalski-skills/skills/animate/` (`RECIPES.md` has code) |
| Motion opportunities: where motion is missing, with restraint | `REFS/emilkowalski-skills/skills/find-animation-opportunities/SKILL.md` |
| Motion performance: frame budget, composite-only properties, CSS vs WAAPI vs rAF, `will-change`, jank diagnosis | `REFS/emilkowalski-skills/skills/animation-performance/SKILL.md` (causes in **Phase 2: Diagnose**, fixes in **The Symptom Table**) |
| Motion codebase audit: the hunt checklist across every animation in an app | `REFS/emilkowalski-skills/skills/improve-animations/` (`AUDIT.md` has the checklist) |
| Motion names: vague description to exact term ("the bouncy popover thing") | `REFS/emilkowalski-skills/skills/animation-vocabulary/SKILL.md` (**Glossary**) |
| Gesture and physical motion: 1:1 drag, interruptibility, velocity handoff, momentum, rubber-banding, materials | `REFS/emilkowalski-skills/skills/apple-design/SKILL.md` (**Quick Reference** has the values; its Typography section yields to `better-typography`), plus **Gesture and Drag Interactions** in `emil-design-eng/SKILL.md` for the web mechanics |
| React Native / Expo motion: threads, Reanimated, Gesture Handler, haptics, on-device stutter | `REFS/emilkowalski-skills/skills/animate-expo/` (`RECIPES.md` has code); when it applies is recon step 1 |
| Worst-case data: realistic break values, failure signatures, truncate vs wrap vs clamp | `REFS/emilkowalski-skills/skills/break-ui/` (`CATALOG.md` has the values) |
| Mobile feel: viewport, tap, safe areas, sticky hover | `REFS/emilkowalski-skills/skills/mobile-native/SKILL.md` |
| Library pick: curated list per task, charts included | `REFS/emilkowalski-skills/skills/pick-ui-library/SKILL.md` |
| Sonner toasts: setup, styling ladder, troubleshooting | `REFS/emilkowalski-skills/skills/ask-sonner/` (`API.md` has the props) |
| Design to code: Figma or image source, token mapping, deviation report | `REFS/jakubkrehel-skills/skills/build-design/` (`figma.md` has the MCP calls) |
| Component states: every state the code reaches, mock data at the data boundary, switcher | `REFS/jakubkrehel-skills/skills/state-machine/` (`switcher.md` has the spec) |
| Design exploration: variants on one axis behind a picker | `REFS/jakubkrehel-skills/skills/variant/` (`picker.md`) |
| Stress harness: scenario axes, one page, one look | `REFS/jakubkrehel-skills/skills/break/` (`scenarios.md`) |
| Consolidation: severity scale, escalation triggers, cap, cheaper-fix ladder, report format | `REFS/jakubkrehel-skills/skills/better-interface/` (`review-format.md`) |
| Change review: scope resolution, blast radius, removed signals, finding status | `REFS/jakubkrehel-skills/skills/interface-review/` (`scope-resolution.md`, `removed-signals.md`) |
| Philosophy and full component catalogue (long; read sections on demand) | `REFS/emilkowalski-skills/skills/emil-design-eng/SKILL.md` |
| Compact polish checklist (19 principles, overlaps `better-ui`) | `REFS/make-interfaces-feel-better/skills/make-interfaces-feel-better/` |
| Craft supplements: edge-aware scroll fades, the root canvas, tiled grain, smoothing caveats, hanging punctuation, input never locked mid-motion, press scale per surface | Named sections only, since the rest of each file repeats an owner above: `REFS/craft/skills/craft-design-engineering/references/typography.md` (**Font Smoothing**; **Hanging punctuation** in **Optical Alignment**), `REFS/craft/skills/craft-design-engineering/references/color.md` (**Noise**), `REFS/craft/skills/craft-design-engineering/references/layout.md` (**HTML Background**, **Scroll Fades**), `REFS/craft/skills/craft-design-engineering/references/motion.md` (**Button Press**, **Interruptibility**). Conflicts resolve per the craft line in the [reviewer-prompt.md](reviewer-prompt.md) Template. |

Emil's files open with an `## Initial Response` block meant for direct invocation. It is inert here: read past it. The same holds for `disable-model-invocation` in the jakubkrehel frontmatter: this router is the invocation, so `interface-review`, `variant`, `break` and `state-machine` are read like any other reference.

### Not routed

- `REFS/emilkowalski-skills/skills/prototype/`: the same job as `variant`, which owns Variant mode; one harness per mode.
- `REFS/emilkowalski-skills/skills/write-swift/`: Swift language practice, not interface work.
- `REFS/jakubkrehel-skills/skills/technical-drawing/`: drawings of physical objects, not interface work, and its viewer installs packages.
- `REFS/jakubkrehel-skills/skills/explain-interface/`: studies someone else's site, never asked for here.
- `REFS/craft/content/`: craft's unlaunched drafts. A launched concept lands in a craft `references/` file; a file this table does not cite prints as `UNROUTED`.

## Step 0: Recon (every mode)

Before any reference is read, establish the project facts. They go into every subagent prompt and every fix.

1. **Stack and styling system**: framework, CSS approach, component library, motion library, chart library, from `package.json` and the root layout. React Native or Expo → `animate-expo` replaces `animate`, `animation-performance` and `mobile-native` everywhere in this skill (Build, Visualize, Motion and the motion reviewer), and the **mobile** trigger is off. Jank mode runs its **6. Keep it off the JS thread**, **Setup that silently breaks motion** and **120fps** in place of the `animation-performance` Workflow. The browser checks below do not reach a native screen: say so, and mark those checks Not verified.
2. **Tokens**: the global stylesheet (`globals.css`, theme file, Tailwind config). Note radius, spacing, easing, duration and color tokens by name.
3. **Shared components**: the project's own primitives (buttons, dialogs, tables, filters, charts, empty/error/loading states). A fix reuses them before adding markup.
4. **Project conventions**: `CLAUDE.md`, `AGENTS.md`, design-system docs. Hard rules there (a banned library, a mandated wrapper) are constraints, not findings.
5. **Supported viewports and personality**: mobile-first or desktop tool; playful product or crisp dashboard. Motion severity and density depend on it.
6. **Preview and gates**: the dev URL, login route if any, and the project's verification commands (typecheck, lint, test, lighthouse).
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
| "Improve / polish / redesign / review this page or component" | **Audit** | [audit.md](audit.md) |
| "Create / build this screen, flow, component or dashboard" | **Build** | [build.md](build.md) |
| "Build this from the Figma / this mockup / this screenshot" | **Design** | Read `build-design/SKILL.md` and `figma.md`, and follow its five steps: the design decides, every value maps to a project token. Before its **Report and stop**, run [audit.md](audit.md) steps 1 to 4 on the build, at the frames' widths and over every state the code reaches (step 2 is build-design's comparison screenshots, one per frame width). Sort each kept finding into build-design's report: the design breaks a rule → **Domain conflicts**, with its owner; a state the design does not draw → **Missing states**; anything else is outside the piece and dropped. Apply none without the user's word. |
| "Visualize this data" / "a chart / KPI for X" in an existing screen | **Visualize** | [visualize.md](visualize.md). A whole new screen of charts is Build, which runs visualize.md for its chart parts. |
| "Which library for toasts / charts / drag-and-drop / OTP / ⌘K..." | **Library** | Read `pick-ui-library/SKILL.md`. Check `package.json` before recommending; reuse what is installed. The pick is Sonner → wire it per `ask-sonner/SKILL.md`. |
| "Toasts appear twice / sit behind the modal / ignore dark mode", Sonner setup or styling | **Toast** | Read `ask-sonner/SKILL.md`; `API.md` for an exact prop. Styling follows its escalation ladder, in the project's tokens. |
| "Animate X" / "add motion" / "this feels static" / "what could animate here?" | **Motion** | [motion.md](motion.md): `find-animation-opportunities` sweeps a scope with no named target, `animate` builds what survives its gate, a fresh `review-animations` reviewer approves or blocks. Zero lines is a valid outcome. |
| "This animation stutters / drops frames / is janky" | **Jank** | Read `animation-performance/SKILL.md` and run its **Workflow** through the Phase 3 report: what animates, the cause from **Phase 2: Diagnose**, the fix from **The Symptom Table**, and the Verified field. The user asked for smooth motion, so that request is the "when asked": apply the fixes, each naming its cause. A performance trace (`chrome-devtools-axi`) under CPU throttle is partial evidence only; a finding it cannot settle stays "needs a device recording". |
| "Show me options for this UI" | **Variant** | Read `variant/SKILL.md` + `picker.md`: three structurally different answers behind a picker on the real page. |
| "Show every state of this component" / "I want to work on its loading/empty/error looks" | **States** | Read `state-machine/SKILL.md` + `switcher.md` and follow it: a throwaway page, mock data at the data boundary, a grouped switcher, handed over and left up until the user says done. |
| "Stress-test this component" / "try the worst case" | **Break** | [break.md](break.md): jakubkrehel `break` harness filled with emilkowalski `break-ui` worst-case values. |
| "Review this diff / branch / PR / my uncommitted changes" | **Change** | [change.md](change.md). Read-only; fixes only when the user asks. |

Audit, Build and Visualize all end with the **review gate** in [audit.md](audit.md); Build and Visualize reach it after the screen exists. Change reaches it only when the user asks for the fixes. Motion ends with its own review in [motion.md](motion.md) step 3.

## Depth

Audit runs at one of three depths. Read the depth from the request; default is `standard`.

| Depth | Request shape | Reviewers | Rounds |
| --- | --- | --- | --- |
| `quick` | "quick pass", "just the obvious" | accessibility, polish, motion; conditional ones only when the request names them | 1 |
| `standard` | any other improve request | the default set plus every conditional reviewer recon switched on | 1 |
| `exhaustive` | "ao máximo", "everything", "every component", "make it as good as it can be" | `standard` plus the `improve-animations` hunt checklist for the motion reviewer; inventory, apply policy and rounds per **Exhaustive** in [audit.md](audit.md) | until a round has no HIGH or MEDIUM and nothing carried, at most 3 |

## Domain reviewers (fan-out)

A review of a screen runs one read-only subagent per domain, in parallel, each holding only its own reference. The main thread never reviews six domains inline: that thins attention and fills context with reference text.

- Prompt template: [reviewer-prompt.md](reviewer-prompt.md). Fill TASK, CONTEXT (recon block, scope files, preview URL) and the domain's reference paths.
- Default set: accessibility, layout, writing, typography, colors, polish, motion (seven).
- Conditional set, added per recon step 7: **worst case** → worst-case reviewer; **gesture** → gesture reviewer; **mobile** → mobile reviewer; **data viz** → data-viz reviewer.
- Subagent type `general-purpose` in Claude Code, or the harness's equivalent read-only worker. Reviewers return findings only, no edits.
- A domain whose reference is missing on disk is `Not reviewed`, named in the report. Never rebuild its rules from memory or hand it to a neighbour.
- Consolidation stays in the main thread: read `better-interface/SKILL.md` (**Rank by user impact**, **Prefer the cheaper fix**, **Consolidate systemic findings**, **Verify what can be verified**) and `review-format.md`, then merge to one ranked table under its severity scale, its cap of 15, and its cheaper-fix ladder (delete, platform, reuse, correct value, add). Re-read the cited line of every finding before keeping it.

## Evidence

Every finding and every claim of improvement cites `path:line` and, where rendering decides it, a browser observation. The browser on this machine is `chrome-devtools-axi` (`open`, `snapshot`, `screenshot`, `eval`, `console`); read `chrome-devtools-axi <command> --help` before use.

Minimum browser pass for a screen: screenshot at desktop width and at 320px, `snapshot` for accessible names and focus order, one keyboard walk of the primary flow, and `prefers-reduced-motion` emulated once when motion exists. A check that cannot run is reported as **Not verified**, never inferred.

## Before you finish

| Mistake | Fix |
| --- | --- |
| A fix written in a new styling idiom or a new token | Rewrite it with the project's tokens and components from recon |
| Six domain reports pasted one after another | One consolidated table in the `better-interface` format |
| Finding kept from a subagent without re-reading the line | Open the file at the cited line; drop what does not reproduce |
| Motion added because it looked nice | Run `animate`'s gate; delete motion on high-frequency or keyboard paths |
| Motion mode shipped on the author's own read of the diff | Dispatch the motion reviewer per [motion.md](motion.md) step 3 and close on its Approve or Block |
| Drag, flick or sheet tuned with a duration and a curve | Springs with velocity handoff, values from `apple-design` **Quick Reference** |
| Jank "fixed" with `will-change` alone | Name the cause from **Phase 2: Diagnose**; swap the property or move the work off the main thread first |
| Demo data only, or an invented worst case (`aaaa…`) | Values from `break-ui/CATALOG.md` or the schema limit |
| A recon step 7 trigger was yes but its reviewer never ran | Dispatch it, or name it `Not reviewed` in the report |
| `exhaustive` asked, one round of 15 delivered | Run the next round per **Exhaustive** in [audit.md](audit.md) until its stop condition |
| A component on the inventory with no reviewer verdict | Re-dispatch for it, or list it as Not reviewed |
| A chart styled with the library's default palette or font | Series colors and type from the project's tokens per [visualize.md](visualize.md) |
| A Figma value hit with an arbitrary utility or a raw hex | Map it to a token per `build-design`, or ask when rounding shows |
| "Improved" claimed from source alone | Before/after screenshot, or mark Not verified |
| Project gates skipped after edits | Run the recon step 6 commands and report their output |
| `update-refs.sh` printed `UNROUTED` or `MISSING` and nobody heard | Name each line to the user as a follow-up for the agent-dotfiles repo |
