---
name: ui-polish
description: Build or improve a web UI (page, screen, component, flow) to a design-engineer craft bar on any stack, with no package required, routing to the jakubkrehel and emilkowalski reference skills. Use when asked to create a screen or component from scratch, improve/polish/redesign an existing page ("improve the UI", "make the UI look better.", "feels off"), review UI or motion quality, add or fix animations, pick a UI library, show variants, or stress-test a component. Skip for pure logic, data or backend work; Libraries.dev effects go to ui-craft.
---

# UI polish

One router, stack-agnostic. The taste lives in the reference library; this file decides which reference to read, when, and how the work is verified. Reading a reference means loading the whole file, not a grep. No rule here needs a package to be applied.

`ui-craft` is this skill plus Libraries.dev: it reads this file as its foundation and layers the effects on every mode below.

The **project's design system is the direction**. Tokens, component library, density and motion language already in the repo win over anything a reference proposes. A reference supplies the rule and the exact value; the project supplies the idiom the fix is written in. Never introduce a second styling system, a parallel token set, or a new aesthetic to apply a rule.

## Reference library

`REFS` = `~/.claude/ui-refs` (Windows: `C:\Users\<user>\.claude\ui-refs`). Missing or stale → run `bash ~/.claude/skills/ui-polish/update-refs.sh` (clone-or-pull, idempotent). Every reference is a whole directory: `SKILL.md` is the rule set, sibling `.md` files hold the exact values.

| Domain | Owner (read `SKILL.md` + siblings) |
| --- | --- |
| Accessibility: names, focus, keyboard, hit areas, reduced motion | `REFS/jakubkrehel-skills/skills/better-accessibility/` |
| Layout: grouping, alignment, reading order, breakpoints, growth | `REFS/jakubkrehel-skills/skills/better-layout/` |
| Writing: labels, errors, empty states, one voice | `REFS/jakubkrehel-skills/skills/better-writing/` |
| Typography: scale, wrapping, tabular nums, truncation | `REFS/jakubkrehel-skills/skills/better-typography/` |
| Colors: tokens, ramps, measured contrast | `REFS/jakubkrehel-skills/skills/better-colors/` |
| Polish: concentric radius, optical alignment, surfaces, icons, enter/exit | `REFS/jakubkrehel-skills/skills/better-ui/` |
| Motion bar: ten standards, escalation triggers, exact curves and durations | `REFS/emilkowalski-skills/skills/review-animations/` (`STANDARDS.md` has the values) |
| Motion build: the gate, then the decision order | `REFS/emilkowalski-skills/skills/animate/` (`RECIPES.md` has code) |
| Motion opportunities: where motion is missing, with restraint | `REFS/emilkowalski-skills/skills/find-animation-opportunities/SKILL.md` |
| Mobile feel: viewport, tap, safe areas, sticky hover | `REFS/emilkowalski-skills/skills/mobile-native/SKILL.md` |
| Library pick: curated list per task | `REFS/emilkowalski-skills/skills/pick-ui-library/SKILL.md` |
| Consolidation: severity scale, cap, cheaper-fix ladder, report format | `REFS/jakubkrehel-skills/skills/better-interface/` (`review-format.md`) |
| Philosophy and full component catalogue (long; read sections on demand) | `REFS/emilkowalski-skills/skills/emil-design-eng/SKILL.md` |
| Compact polish checklist (19 principles, overlaps `better-ui`) | `REFS/make-interfaces-feel-better/skills/make-interfaces-feel-better/` |

Emil's files open with an `## Initial Response` block meant for direct invocation. It is inert here: read past it.

## Step 0: Recon (every mode)

Before any reference is read, establish the project facts. They go into every subagent prompt and every fix.

1. **Stack and styling system**: framework, CSS approach, component library, motion library, from `package.json` and the root layout.
2. **Tokens**: the global stylesheet (`globals.css`, theme file, Tailwind config). Note radius, spacing, easing and duration tokens by name.
3. **Shared components**: the project's own primitives (buttons, dialogs, tables, filters, empty/error/loading states). A fix reuses them before adding markup.
4. **Project conventions**: `CLAUDE.md`, `AGENTS.md`, design-system docs. Hard rules there (a banned library, a mandated wrapper) are constraints, not findings.
5. **Supported viewports and personality**: mobile-first or desktop tool; playful product or crisp dashboard. Motion severity and density depend on it.
6. **Preview and gates**: the dev URL, login route if any, and the project's verification commands (typecheck, lint, test, lighthouse).

Write recon as a short block. It is the CONTEXT section of every reviewer prompt.

## Modes

Pick one from the request. State it in one line before starting.

| Request shape | Mode | Procedure |
| --- | --- | --- |
| "Improve / polish / redesign / review this page or component" | **Audit** | [audit.md](audit.md) |
| "Create / build this screen, flow or component" | **Build** | [build.md](build.md) |
| "Which library for toasts / charts / drag-and-drop / OTP / ⌘K..." | **Library** | Read `pick-ui-library/SKILL.md`. Check `package.json` before recommending; reuse what is installed. |
| "Animate X" / "add motion" / "this feels static" | **Motion** | Read `animate/SKILL.md`. Run its gate first: frequency and purpose decide whether anything animates at all. Zero lines is a valid outcome. |
| "Show me options for this UI" | **Variant** | Read `REFS/jakubkrehel-skills/skills/variant/SKILL.md` + `picker.md`: three structurally different answers behind a picker on the real page. |
| "Stress-test this component" | **Break** | Read `REFS/jakubkrehel-skills/skills/break/SKILL.md` + `scenarios.md`: every state on one temporary page. |

Audit and Build both end with the **review gate** in [audit.md](audit.md); Build reaches it after the screen exists. A request for a Libraries.dev effect, or recon finding a Libraries.dev package (`border-beam`, `thinking-orbs`, `liquid-gooey`, `voice-glow`, `bot-avatars`, `metal-fx`, `img-fx`) in `package.json`, is `ui-craft`'s: say so in one line and hand over.

## Domain reviewers (fan-out)

A review of a screen runs one read-only subagent per domain, in parallel, each holding only its own reference. The main thread never reviews six domains inline: that thins attention and fills context with reference text.

- Prompt template: [reviewer-prompt.md](reviewer-prompt.md). Fill TASK, CONTEXT (recon block, scope files, preview URL) and the domain's reference paths.
- Default set: accessibility, layout, writing, typography, colors, polish+motion (six). `quick` scope: accessibility and polish+motion only.
- Subagent type `general-purpose` in Claude Code, or the harness's equivalent read-only worker. Reviewers return findings only, no edits.
- Consolidation stays in the main thread: read `better-interface/SKILL.md` sections 6 to 9 and `review-format.md`, then merge to one ranked table under its severity scale, its cap of 15, and its cheaper-fix ladder (delete, platform, reuse, correct value, add). Re-read the cited line of every finding before keeping it.

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
| "Improved" claimed from source alone | Before/after screenshot, or mark Not verified |
| Project gates skipped after edits | Run the recon step 6 commands and report their output |
