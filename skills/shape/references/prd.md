# Shaping a PRD from a raw idea

The destination artifact is a `PRD.md` an implementer agent could build from without asking a single question.
Walk the tree top-down; each layer is roughly one frontier round, though rounds may mix layers as the frontier allows.

## The greenfield tree

1. **Problem & user** (scope) — what hurts, for whom, how they cope today. One sentence each; the problem statement leads the PRD.
2. **Success** (scope) — what "working" looks like in observable terms; what v1 explicitly does not do (non-goals).
3. **Features** (menu round) — research comparable tools first, then present the feature menu via `multiSelect`: table stakes for the domain, differentiators, and things the user likely hasn't imagined. The user curates in and out; everything curated out lands in non-goals.
4. **Workflows & taste** (taste rounds) — for each core feature, the user reacts to contrasting concrete options: rough flows, ASCII mockups, reference products. Extract the criterion behind each reaction into the PRD, not just the choice.
5. **Stack & architecture** (expertise, per technical-decision mode) — platform, framework, data store, hosting, auth. In delegate mode this is a short "chosen + rationale" block the user can veto, not a question.
6. **Risks & assumptions** — blindspot pass if [unknowns.md](unknowns.md) is loaded; otherwise list the labeled assumptions accumulated during the rounds.

## PRD.md skeleton

```markdown
# <Product name>

## Problem
<one paragraph: who hurts, what hurts, how they cope today>

## Users
<primary persona(s), one line each>

## Success criteria
<observable outcomes; measurable where possible>

## Features (v1)
<per feature: name, one-paragraph behavior, acceptance criteria>

## Non-goals
<curated-out features and explicit scope boundaries>

## UX direction
<the taste criteria extracted from reactions: tone, density, hierarchy, references>

## Stack
<chosen stack + one-line rationale per major choice; mark "delegated" choices>

## Risks
<ranked; each with its cheap mitigation>

## Assumptions
<every labeled default the user has not yet confirmed>

## Open questions
<only material unknowns that survived the session, ranked by risk>
```

## Quality bar

- Every feature has acceptance criteria an agent can verify.
- Every assumption is labeled and visible — none silently baked in.
- The stack section exists even in delegate mode; delegation moves the decision, not the documentation.
- Non-goals are as load-bearing as features: they are the curated-out menu items, written down so they stay out.
