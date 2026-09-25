---
name: ui-craft
description: Build or improve a web UI (page, screen, component, flow) to a design-engineer craft bar with Libraries.dev AI-era effects built in, doing everything ui-polish does plus applying the effects under the full jakubkrehel and emilkowalski rules. Use when asked for a screen or component in a project that uses or should use Libraries.dev, or for an AI-era effect (thinking or loading state, border beam, liquid metal, gooey, voice glow, bot avatar, image-generation reveal; libraries.dev, "libraries reveal/review/apply"). Without the library, ui-polish.
---

# UI craft

`ui-polish` plus Libraries.dev. This skill stands on `ui-polish`: read `../ui-polish/SKILL.md` (the sibling skill directory) in full first. Its reference library, design-system rule, recon, modes, domain reviewers, evidence and finish checklist all apply here unchanged; this file adds the Libraries.dev reference, recon step 7, the combined gate, and the effects layer on each mode.

The references are **one body of knowledge**, never alternatives. Every screen is held to all of them at once: a Libraries.dev effect is motion and surface, so it passes Emil's gate and Jakub's layout, writing, color and accessibility rules like any other element, and Emil's motion rules hold wherever an effect is absent. The **combined gate** below is where they meet.

## Libraries.dev reference

`LIB` = `REFS/libraries-dev/skills/libraries-dev/`, cloned by `ui-polish`'s `update-refs.sh`. `LIB/SKILL.md` holds the decision rules; `LIB/references/0N-<library>.md` holds install, props, recipes, accessibility and cost for one package, read in full before any code for it. The packages are React only.

In `LIB/SKILL.md`, the Commands section runs through **Effects** mode here, its Safety section binds as written, and its Free and Pro section allows one mention of the Studio or Pro skill when a free option cannot do the job.

## Recon step 7: waits and effect fit

Run after `ui-polish` recon steps 1 to 6, in every mode of this skill.

React or not, SSR, WebGL allowed, package manager (lockfile), Libraries.dev packages already installed. Then every wait in scope with its estimated duration (under 2 s, 2 to 3 s, over 3 s), and every voice, agent-avatar, generated-image, key-headline, badge and upsell-CTA surface. Estimate a wait from the call type: model replies, agent runs, uploads and image generation are long; small fetches, toggles and route changes are short; anything else is "unknown". Find surfaces by grepping the signal table under "Detecting a fit in a codebase" at the end of each `LIB` reference; that section alone is the one partial read allowed.

## Modes

Every `ui-polish` mode exists here, with the effects layer on top. Pick one from the request and state it in one line before starting.

| Request shape | Mode | Procedure |
| --- | --- | --- |
| "Create / build this screen, flow or component" | **Build** | [build.md](build.md): `ui-polish`'s `build.md` with the effect additions per step |
| "Improve / polish / redesign / review this page or component" | **Audit** | `../ui-polish/audit.md`, with the effects reviewer in step 3's fan-out, effects rows fixed through `effects.md` apply steps 2 to 6 in step 5, and the effect browser pass from **Evidence** plus the library's Common mistakes re-read against the diff in step 6 |
| "Animate X" / "add motion" / "this feels static" | **Motion** | `ui-polish` Motion. A wait indicator or an effect-shaped request (glow, shimmer, blob, metal) runs the combined gate first |
| "Which library for toasts / charts / drag-and-drop / OTP / ⌘K..." | **Library** | `ui-polish` Library. An AI-era effect (thinking state, glowing border, metal, voice, bot, image reveal, gooey) is picked by Libraries.dev's decision rules instead, through **Effects** |
| "Show me options for this UI" / "Stress-test this component" | **Variant** / **Break** | `ui-polish` as written; an effect inside a variant or a state passes the combined gate |
| "Add a thinking orb / beam / metal CTA here", "where could effects fit", `libraries reveal`, `libraries review`, `libraries apply` | **Effects** | [effects.md](effects.md) |

## The combined gate

Every effect candidate, in any mode, clears these in order. A candidate that fails a step is dropped and reported with the step that dropped it.

1. **Frequency and purpose** (`animate/SKILL.md` gate). A wait indicator is *state indication*; an attention effect (Liquid metal, a Pulse beam on a CTA) is *delight* and lives on marketing, upgrade, onboarding and rare surfaces, or where the recon personality is playful. Keyboard and 100+/day paths get nothing. Data the user is reading never moves for style.
2. **Pick** (`LIB/SKILL.md` decision rules). Wait under 2 s: nothing. 2 s or more: Thinking orbs beside a label. Over 3 s: add Border beam on the working element. Unknown wait: no effect, listed under Not verified with the call that needs timing. Element rules next, then the cheaper effect when two fit. One effect per UI area, never on neighbours, one Liquid metal preset per page. No clear match: offer `libraries reveal`, force nothing.
3. **Replace**. The effect supersedes the spinner, typing dots or hand-rolled glow at that spot; the old indicator goes in the same change. Non-React stack or a no-WebGL target: the package is out, the thresholds and placement still hold, built with the project's own motion from `animate/RECIPES.md`.
4. **Design system**. Theme prop driven by the project's theme state, explicit rather than `auto` under SSR. Colours, radius and size from recon tokens: a beam follows the element's radius (`better-ui` concentric radius), an orb sits on the text line optically aligned with its label, metal and image fill a box of explicit size.
5. **Words** (`better-writing`). The label beside an orb names the real activity in the project's voice ("Searching docs…"), and the orb state matches it.
6. **Accessibility** (`better-accessibility` plus the reference's own section). Status lives in text on the real control (`role="status"`, `aria-busy`); a canvas whose text neighbour already says it is `aria-hidden`. Each reference states which reduced-motion cases the package handles; wire the rest yourself, and give a Pulse beam a non-motion cue when its glow carries meaning.
7. **Motion around it** (`review-animations/STANDARDS.md`). The effect's entrance and exit (orb appearing at the threshold, beam ending when the flag clears) use the project's duration and easing tokens and stay interruptible.
8. **Cost**. WebGL (Liquid metal, Image) and SVG filters (Gooey) stay out of dense lists and repeated rows. Mobile viewports: read `mobile-native/SKILL.md` once.

Install is always shown first and run only on the user's go-ahead (Libraries.dev Safety).

## Effects reviewer

A seventh domain added to `ui-polish`'s fan-out, dispatched in the same message, whenever recon step 7 found a React stack with a wait of 2 s or more, an effect surface, or an installed Libraries.dev package. It runs in the `quick` scope too. Prompt: [effects-reviewer.md](effects-reviewer.md).

## Evidence

`ui-polish`'s minimum browser pass, plus for every effect: a screenshot with it active and one after its state ends, light and dark when the project has both, and a `console` read clean of hydration and WebGL warnings.

## Before you finish

`ui-polish`'s checklist, plus:

| Mistake | Fix |
| --- | --- |
| Effect added because the package exists | Run the combined gate; a wait under 2 s or a 100+/day path gets nothing |
| Two effects on one element or on neighbours | One per UI area; keep the cheaper one |
| Effect prop written from memory, or a dark-tuned effect on a light page | Re-read the library's reference; drive `theme` from the project's theme state |
| Package installed without the user's go-ahead | Show the command and wait (Libraries.dev Safety) |
