# Build: a screen from scratch

Build in this order: purpose, structure, then surface, then motion, then review. Each authoring step reads the domain skills the review gate will judge it by, so the rules shape the markup instead of arriving as findings.

## 1. Brief

Write six lines before any code:

- **Purpose**: the one task the screen exists for, and the user who does it.
- **Data and states**: what it shows, and every state from the kinds table in `state-machine/SKILL.md` **Find the states in the code** (data, account, feature) that the screen can reach. Worst-case values come from `break-ui/CATALOG.md` per field (long hyphenated names, unbreakable emails, counts of 1, 1,000 rows), or from the schema limit.
- **Primary action** and the destructive ones.
- **Viewports** from recon; **frequency**: is this seen 100 times a day or once?
- **Neighbours**: the existing screens it must sit beside, by route. Open one in the browser; match its density and chrome.
- **Visual thesis**: the one focal point per viewport and the one idea type, color, imagery and motion all serve, per `no-ai-design-slop` **Choose one coherent idea**. Taken from the neighbours when they exist; greenfield, written once the direction spec below is approved.

Greenfield repo with no tokens and no neighbours → this is the one case a direction is needed. Ask the user for a Figma file, a design image or a reference product, together with the `design-first-ui-prompting` **Questions to ask**. A Figma file or an image switches to **Design** mode. A reference product is read with `explain-interface/SKILL.md` and `read-the-system.md`, every value tagged per **Measured, derived, inferred**; per `no-ai-design-slop` **Start from context**, the spec takes its hierarchy, pacing, contrast, material and interaction principles, never its identity, layout, assets or copy.

Then write the direction spec: the token categories of `no-ai-design-slop` **Start from context** (type roles, spacing rhythm, palette, radii, borders, shadows, imagery, icons, motion), laid out on the GOAL, LAYOUT, TYPE SYSTEM, COLOR + MATERIAL and IMAGERY / UI STYLE blocks of `design-first-ui-prompting` **Prompt Structure**. Two of its lines stay out: the micro-label tracking line, because `no-ai-design-slop` `ARTICLE.md` **Typography and Hierarchy** lists tracked micro-labels as slop, and the photo and 3D lines unless the screen carries such imagery. Its FORMAT, COPY, CONSTRAINTS and NEGATIVE PROMPT blocks prompt image models. A value the answers leave open goes to the user as two or three options to pick from. Get the user's yes, then land the spec as tokens before any markup: the palette per `better-colors` `palette-structure.md`, `palette-generation.md` and `token-naming.md`, the type scale per `better-typography` `spacing-and-sizing.md` and `choosing-fonts.md`. Every value traces to a reference, an answer or a pick, never to an aesthetic invented here.

The screen's job is to show figures, a trend or a comparison → the chart and KPI parts follow [visualize.md](visualize.md) inside steps 3 to 6.

## 2. Libraries

For each non-trivial primitive the brief needs (dialog, menu, table, toast, chart, date, drag, virtual list), check `package.json` and the shared components first. Only for a gap, read `pick-ui-library/SKILL.md` and take its pick. A hand-rolled primitive that `pick-ui-library` **Common mismatches to catch** names is a defect. Toasts with **sonner** → wire and style them per `ask-sonner/SKILL.md`.

## 3. Structure

Read `better-layout/SKILL.md`, `grouping-and-alignment.md` and `spacing-and-adaptivity.md`. Decide grouping, reading order, alignment edges, breakpoints and what collapses at narrow width, in a short outline. Space carries hierarchy; separators come last. Then read `better-writing/SKILL.md` and `patterns.md` and write the real labels, empty-state copy, error copy and destructive-flow copy now, in the project's existing voice, before markup exists.

Done when: the outline names every group, its order and its primary action, and the copy is written.

## 4. Markup with the project's primitives

Read `better-accessibility/SKILL.md`, `semantics-and-aria.md`, `forms.md` and `focus-and-keyboard.md` first. Build with recon's shared components and tokens. Native elements first; a `<button>` is a button. Every state in the brief gets rendered, not just the happy path. A worst-case fixture sits next to the demo fixture from the start, so overflow is designed in, not found later. Logical properties for direction-dependent spacing. Content is the product's own: real copy, data and screenshots, or a placeholder that reads as one, per `no-ai-design-slop` **Make the product specific**.

The build adds a shared component other code will adopt → hold it to `emil-design-eng` **The Sonner Principles (Building Loved Components)**: no setup beyond one mount, good defaults over options, edge cases handled invisibly.

Done when: every state from the brief is reachable in the browser.

## 5. Polish pass

Read `better-typography/SKILL.md` and its siblings, `better-colors/SKILL.md`, `color-usage.md` and `contrast.md`, then `better-ui/SKILL.md`, `surfaces.md` and `icons.md`. Translucent chrome (`backdrop-filter`) → also `apple-design` **Materials & depth**. Walk the screen once against them: concentric radii, optical alignment of icons, shadows versus borders, tabular numbers on changing figures, `text-wrap` on headings and body, hit areas at the accessibility minimum, icon stroke matching text weight, one filled action per view, every color through its token role, a visible cue at each scroll edge with hidden content (`better-layout` **Hint at hidden content**). Exact values from the sibling files, never approximated.

Then read `no-ai-design-slop/SKILL.md` and run its **Compact Quality Gates** over each section, container, decorative layer and pill the build added, and `audit-ai-design-slop` **Use the Removal Test** on every one that fails a gate: what survives names its job.

## 6. Motion

Read `animate/SKILL.md`. Per interactive element, run **The Build Sequence** steps 1 and 2, the gate `find-animation-opportunities` **The Gate** spells out: frequency, purpose, speed, function. Expect to reject most candidates, per `find-animation-opportunities` **Operating Posture**. What survives is built from `RECIPES.md` with the project's easing and duration tokens, ships with `prefers-reduced-motion` and hover gating in the same change, and animates only the properties `animation-performance` **What You Animate** clears. Content is visible in a complete static first frame, without JavaScript, and reduced motion shows a stable final state, per `no-ai-design-slop` `ARTICLE.md` **Motion and Scroll**.

**gesture** in the brief → read the gesture row's references before building it: 1:1 tracking from pointer-down, interruptible springs, velocity handoff on release, rubber-band at the edges, with the spring values from `apple-design` **Quick Reference**.

Mobile in the viewports → read `mobile-native/SKILL.md` once and apply its platform fixes (tap highlight, sticky hover, input zoom, safe areas).

## 7. Review gate

Run the **Audit** procedure from step 3 onward (`audit.md`) on the new screen: fan-out reviewers, consolidate, fix, gates, screenshots, report. A new screen ships only after its own audit returns no HIGH finding and its motion closed on Approve.
