---
name: stitch-design-taste
description: Semantic Design System Skill for Google Stitch. Generates agent-friendly DESIGN.md files that enforce premium, anti-generic UI standards — strict typography, calibrated color, asymmetric layouts, perpetual micro-motion, and hardware-accelerated performance.
---

# Stitch Design Taste — Semantic Design System Skill

## Overview
This skill generates `DESIGN.md` files optimized for Google Stitch screen generation. It translates the battle-tested anti-slop frontend engineering directives into Stitch's native semantic design language — descriptive, natural-language rules paired with precise values that Stitch's AI agent can interpret to produce premium, non-generic interfaces.

The generated `DESIGN.md` serves as the **single source of truth** for prompting Stitch to generate new screens that align with a curated, high-agency design language. Stitch interprets design through **"Visual Descriptions"** supported by specific color values, typography specs, and component behaviors.

## Prerequisites
- Access to Google Stitch via [labs.google/stitch](https://labs.google/stitch)
- Optionally: Stitch MCP Server for programmatic integration with Cursor, Antigravity, or Gemini CLI

## The Goal
Generate a `DESIGN.md` file that encodes:
1. **Visual atmosphere** — the mood, density, and design philosophy
2. **Color calibration** — neutrals, accents, and banned patterns with hex codes
3. **Typographic architecture** — font stacks, scale hierarchy, and anti-patterns
4. **Component behaviors** — buttons, cards, inputs with interaction states
5. **Layout principles** — grid systems, spacing philosophy, responsive strategy
6. **Motion philosophy** — animation engine specs, spring physics, perpetual micro-interactions
7. **Anti-patterns** — explicit list of banned AI design clichés

## Workflow

### 1. Define the Atmosphere
Evaluate the target project's intent. Use evocative adjectives from the taste spectrum:
- **Density:** "Art Gallery Airy" (1–3) → "Daily App Balanced" (4–7) → "Cockpit Dense" (8–10)
- **Variance:** "Predictable Symmetric" (1–3) → "Offset Asymmetric" (4–7) → "Artsy Chaotic" (8–10)
- **Motion:** "Static Restrained" (1–3) → "Fluid CSS" (4–7) → "Cinematic Choreography" (8–10)

Default baseline: Variance 8, Motion 6, Density 4. Adapt dynamically based on user's vibe description.

### 2–8. Apply the design rules (MANDATORY read)
Read `references/design-rules.md` **before** drafting any section of the DESIGN.md. It contains the full mandatory standards for:
- Color palette mapping (accent limits, banned aesthetics, neutral bases)
- Typography (font selection/bans, dashboard constraints, density overrides)
- Hero section (inline image typography, asymmetry, CTA restraint)
- Component stylings (buttons, cards, inputs, loading/empty/error states)
- Layout principles (grid, containment, banned patterns)
- Responsive rules (mobile collapse, touch targets, scaling)
- Motion philosophy (spring physics, perpetual micro-interactions, performance)

### 9. Encode the anti-patterns (MANDATORY read)
Read `references/anti-patterns.md` and encode its full list as explicit "NEVER DO" rules in the DESIGN.md. Do not paraphrase from memory — the exact bans are load-bearing.

### 10. Emit the DESIGN.md (MANDATORY read)
Read `references/output-template.md` for the exact DESIGN.md structure to emit, plus best practices, tips for success, and common pitfalls to avoid. Follow the template's seven sections verbatim in structure; fill values per the rules above.
