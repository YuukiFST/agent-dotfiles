---
name: redesign-existing-projects
description: Upgrades existing websites and apps to premium quality. Audits current design, identifies generic AI patterns, and applies high-end design standards without breaking functionality. Works with any CSS framework or vanilla CSS.
disable-model-invocation: true
---

# Redesign Skill

## How This Works

When applied to an existing project, follow this sequence:

1. **Scan** — Read the codebase. Identify the framework, styling method (Tailwind, vanilla CSS, styled-components, etc.), and current design patterns.
2. **Diagnose** — Run the design audit (below). List every generic pattern, weak point, and missing state you find.
3. **Fix** — Apply targeted upgrades working with the existing stack. Do not rewrite from scratch. Improve what's there.

## Design Audit (MANDATORY reference reads)

The full per-pattern checklists live in `references/`. During the **Diagnose** phase, Read the files relevant to the surfaces you are auditing — for a full redesign, Read all three:

- **Read `references/audit-visual.md`** — Typography, Color and Surfaces, Layout checklists. Required whenever visual styling is in scope (almost always).
- **Read `references/audit-ux.md`** — Interactivity and States, Content, Component Patterns, Iconography checklists. Required when auditing interactive elements, copy, components, or icons.
- **Read `references/audit-technical.md`** — Code Quality and Strategic Omissions (legal links, 404, form validation, skip-link, cookie consent). Required before declaring the audit complete.

## Upgrade Techniques

During the **Fix** phase, when replacing a generic pattern with something premium, **Read `references/upgrade-techniques.md`** — high-impact typography, layout, motion, and surface upgrades (variable font animation, broken grids, spring physics, glassmorphism, etc.).

## Fix Priority

Apply changes in this order for maximum visual impact with minimum risk:

1. **Font swap** — biggest instant improvement, lowest risk
2. **Color palette cleanup** — remove clashing or oversaturated colors
3. **Hover and active states** — makes the interface feel alive
4. **Layout and spacing** — proper grid, max-width, consistent padding
5. **Replace generic components** — swap cliche patterns for modern alternatives
6. **Add loading, empty, and error states** — makes it feel finished
7. **Polish typography scale and spacing** — the premium final touch

## Rules

- Work with the existing tech stack. Do not migrate frameworks or styling libraries.
- Do not break existing functionality. Test after every change.
- Before importing any new library, check the project's dependency file first.
- If the project uses Tailwind, check the version (v3 vs v4) before modifying config.
- If the project has no framework, use vanilla CSS.
- Keep changes reviewable and focused. Small, targeted improvements over big rewrites.
