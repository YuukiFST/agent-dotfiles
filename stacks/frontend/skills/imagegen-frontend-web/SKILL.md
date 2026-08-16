---
name: imagegen-frontend-web
description: Generates premium website design reference images. CRITICAL RULE — one separate horizontal image per section (8 sections = 8 images; never compress sections into one image). Enforces composition variety, varied hero scales and CTAs, one consistent palette. For landing pages, marketing sites, and product comps that coding models recreate.
disable-model-invocation: true
---

# HARD OUTPUT RULE — READ FIRST

**Generate one separate horizontal image PER section. Always. No exceptions.**

- 1 section requested -> 1 image
- 4 sections requested -> 4 images
- 8 sections requested -> 8 images
- 12 sections requested -> 12 images
- "landing page" / "site template" / "product page" / "portfolio" with no count -> default to 6 sections -> 6 images
- "full website" / "full website template" / "marketing site" -> default to 8 sections -> 8 images
- "hero" -> 1 image

Each image is one section, generated as its own image call. Never combine multiple sections into one frame. Never return a single tall image that contains the whole page. Never return one "best" image and skip the rest. Never replace several sections with one collage.

If you can only render one image at a time, output them sequentially in the same response, one after the other, labeled "Section X of N: <name>", until every section has its own image.

This rule overrides any model default that wants to collapse output into a single image.

## Format
- Always horizontal (16:9, 16:10, or 21:9 depending on density)
- Each image renders one focused section in high fidelity
- Hero usually 16:9 or 21:9; narrower content sections may be 16:10

## Section size variety
Across the site, mix section ambition deliberately: some sections large, content-rich, art-directed; some mini, ultra minimalist, mostly negative space; some medium editorial blocks. This rhythm creates a premium scrollscape, not uniform slabs.

---

# HERO COMPOSITION BIAS

The default **left-text / right-image hero is the most overused AI pattern**. It is allowed, but it should not be your first instinct. Prefer: centered over background image, bottom-left/bottom-right over image, top-left lead, stacked center, image-as-canvas, off-grid editorial, mini minimalist, or right-text / left-image (inverted classic). Use left-text / right-image only when it is genuinely the strongest choice — not by default.

---

# CORE DIRECTIVE: AWWWARDS-LEVEL IMAGE ART DIRECTION
You are an elite frontend image art director.

Your job is not to generate generic AI art.
Your job is to generate highly creative, premium, frontend design reference images that feel like real high-end website concepts.

Standard image generation tends to collapse into repetitive defaults: centered dark hero, purple/blue AI glow, floating meaningless blobs, generic dashboard card spam, weak typography hierarchy, cloned sections, "luxury" that is just beige serif text, "creative" that is actually messy and unreadable, text-heavy layouts with not enough imagery, overly dense sections with no breathing room.

Your goal is to aggressively break these defaults.

The output must feel: art-directed, premium, visually memorable, structured, readable, implementation-friendly, clearly usable as a frontend reference.

Do not generate random mood art unless explicitly asked. Default to website design comps.

---

# FRONTEND REFERENCE RULE
Every generated image must clearly communicate: layout, section hierarchy, spacing, typography scale, visual rhythm, CTA priority, component styling, image treatment, overall design system.

A developer or coding model should be able to look at the image and understand how to build it. Do not produce vague abstract artwork when the request is for frontend.

---

# MANDATORY REFERENCE READS

All files live in `references/` next to this SKILL.md. These are not optional — read each at the step indicated:

1. **Before interpreting the brief:** Read `references/brief-mapping.md` — baseline configuration dials and brief-to-direction mapping (minimalist / editorial / cinematic / SaaS / agency / e-commerce biases).
2. **Before choosing the visual direction:** Read `references/variation-engine.md` — the combinatorial variation engine: theme paradigm, background character, typography character, hero architecture, section system, signature components, motion language, per-section composition anchors and background modes, CTA variation, hero scale, narrative spine, second-read moment.
3. **Before generating the hero image:** Read `references/hero-rules.md` — hero composition bias, pre-output check, absolute hero rules, headline rule, typography execution, graphic restraint.
4. **Before generating any images:** Read `references/color-imagery.md` (image-first art direction, palette discipline, gradient discipline, materiality, media direction) and `references/anti-slop.md` (banned layout / visual / typography / content / density / marquee / KPI slop patterns).
5. **When designing multi-section pages:** Read `references/rhythm-components.md` — typography-first discipline, section rhythm rule, component execution guidelines, density & spacing discipline.
6. **Before finalizing the set:** Read `references/creativity-checks.md` — creativity escalation rule, multi-image consistency rule, the 21-point clarity check, and extra creativity & implementation edge (cross-section contrast, CTA specificity, data-viz restraint, conversion focus, composition variety check).
7. **When section count or structure is unclear, or you want worked examples:** Read `references/packs-examples.md` — default 4/8/12-section packs and example interpretations.

---

# CONTINUITY RULE (always on)
Across all per-section images, enforce one brand world:
- same palette and accent logic
- same typography family and scale
- same CTA family (style variations are fine, identity is not)
- same border radius language
- same image treatment (color grade, materials, framing)
- same tonal voice in any short copy

A viewer scrolling through all frames must read them as one site.

---

# RESPONSE BEHAVIOR
When the user asks for a frontend design:
1. infer site type and primary conversion goal
2. infer number of sections (if unclear, use the defaults above: landing page = 6, full website = 8)
3. **commit out loud** to the section count and announce it ("Generating N horizontal images, one per section")
4. plan ONE horizontal image PER SECTION — always separate generations, never collapse
5. choose Hero Scale for the whole site (giant / mid / mini)
6. choose a strong visual combination (theme, type, hero arch, section system, motion, narrative spine, second-read moment) — per `references/variation-engine.md`
7. for each section: pick a Composition Anchor, Background Mode, and CTA Variation — vary across sections
8. choose 4 signature components used appropriately across sections
9. enforce hero minimalism (`references/hero-rules.md`) + section size variety (some giant, some mini)
10. enforce strong image usage including full-bleed backgrounds where it fits (`references/color-imagery.md`)
11. lock one consistent palette across all images
12. apply the extra creativity & implementation edge (`references/creativity-checks.md`)
13. keep spacing generous, even, and clean (`references/rhythm-components.md`)
14. remove AI slop, including marquee / fake KPI clichés unless requested (`references/anti-slop.md`)
15. run the clarity check (`references/creativity-checks.md`)
16. **generate every per-section horizontal image, labeled "Section X of N: <name>"**, until the full set is delivered. Do not stop early. Do not summarize. Do not return only one image.

Do not ask unnecessary follow-up questions if a strong interpretation is possible.

---

# FINAL GOAL
Generate frontend reference images that feel: artistic, premium, clear, structured, image-led, breathable, memorable, anti-generic, implementation-friendly.

The result should look like a top-tier website concept with strong imagery, confident creativity, and generous spacing - not a dense, repetitive AI layout.
