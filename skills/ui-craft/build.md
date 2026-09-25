# Build: a screen from scratch

Build in the order that decides quality: purpose, structure, then surface, then motion, then review. Reversing it produces a templated page with animations glued on.

## 1. Brief

Write five lines before any code:

- **Purpose**: the one task the screen exists for, and the user who does it.
- **Data and states**: what it shows; empty, loading, error, partial, overflow (long strings, 500 rows).
- **Primary action** and the destructive ones.
- **Viewports** from recon; **frequency**: is this seen 100 times a day or once?
- **Waits and effect surfaces**: every async step with its estimated duration (under 2 s, 2 to 3 s, over 3 s), and any voice, agent-avatar, generated-image, key-headline, badge or upsell-CTA surface.
- **Neighbours**: the existing screens it must sit beside, by route. Open one in the browser; match its density and chrome.

Greenfield repo with no tokens and no neighbours → this is the one case a direction is needed. Ask the user for a reference product or screenshot; do not invent an aesthetic.

## 2. Libraries

For each non-trivial primitive the brief needs (dialog, menu, table, toast, chart, date, drag, virtual list), check `package.json` and the shared components first. Only for a gap, read `pick-ui-library/SKILL.md` and take its pick. Hand-rolling one of those is a defect.

For each wait and effect surface in the brief, run the combined gate in `SKILL.md` **Effects**. Each survivor gets its Libraries.dev reference read in full now, so the markup is written around it; its install follows `effects.md` apply step 3.

## 3. Structure

Read `better-layout/SKILL.md` and `grouping-and-alignment.md`. Decide grouping, reading order, alignment edges and what collapses at narrow width, in a short outline. Space carries hierarchy; separators come last. Then read `better-writing/SKILL.md` and write the real labels, empty-state copy and error copy now, in the project's existing voice, before markup exists.

Done when: the outline names every group, its order and its primary action, and the copy is written.

## 4. Markup with the project's primitives

Build with recon's shared components and tokens. Native elements first; a `<button>` is a button. Every state in the brief gets rendered, not just the happy path; a loading state carries its chosen effect wired to the real flag. Logical properties for direction-dependent spacing.

Done when: every state from the brief is reachable in the browser.

## 5. Polish pass

Read `better-ui/SKILL.md` and `surfaces.md`, plus `better-typography/SKILL.md`. Walk the screen once against them: concentric radii, optical alignment of icons, shadows versus borders, tabular numbers on changing figures, `text-wrap` on headings and body, hit areas at the accessibility minimum, icon stroke matching text weight, effects sized and radiused from tokens with their labels aligned. Exact values from the sibling files, never approximated.

## 6. Motion

Read `animate/SKILL.md`. Run its gate per interactive element: frequency, purpose, budget. Most elements on a product screen get no motion or press feedback only. What survives the gate is built from `RECIPES.md` with the project's easing and duration tokens, ships with `prefers-reduced-motion` and hover gating in the same change. Effects from step 2 are motion too: their entrance, exit and the reduced-motion cases their package leaves open are built here, per combined gate steps 6 and 7.

Mobile in the viewports → read `mobile-native/SKILL.md` once and apply its platform fixes (tap highlight, sticky hover, input zoom, safe areas).

## 7. Review gate

Run the **Audit** procedure from step 3 onward (`audit.md`) on the new screen: fan-out reviewers, consolidate, fix, gates, screenshots, report. A new screen ships only after its own audit returns no HIGH finding.
