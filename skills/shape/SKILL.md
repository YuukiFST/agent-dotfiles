---
name: shape
description: Shape a raw idea, plan, or design into a buildable artifact (PRD, spec, plan, decision) through routed questioning and expert co-design. Use when the user wants to stress-test a plan before building, define a project from scratch, flesh out vague requirements, or uses any 'grill' or 'shape' trigger phrases.
---

# Shape

An idea arrives without a shape: decisions unmade, features unimagined, terms fuzzy.
Shaping walks the **design tree** — every decision branches into the decisions that hang off it — until user and agent hold the same map and the destination artifact is written.
The user may not hold the answers: they may not know the right stack, or even every feature their own idea implies.
So shaping is co-design, not interrogation — the agent contributes expertise and proposals, the user contributes taste, scope, and vetoes.

## Intake (first round, always)

Settle two things before any shaping question, inferring from the request when obvious and asking when not:

1. **Destination artifact** — what this session produces: a PRD, an implementation plan/spec, or a single decision. Load the matching reference before round two:
   - Greenfield product or feature, PRD wanted → [references/prd.md](references/prd.md)
   - Existing plan/spec/PR to stress-test → [references/plan-review.md](references/plan-review.md)
   - Unfamiliar territory, high ambiguity, or a previous attempt failed on hidden assumptions → also [references/unknowns.md](references/unknowns.md)
2. **Technical-decision mode** — how the user wants expertise decisions handled: **delegate** (agent picks and records rationale), **explain-then-choose** (agent presents options with trade-offs), or **user decides**. This routes every expertise question for the rest of the session; a non-technical user answers it once and never sees a stack question again.

## Answer-owner routing

Before any node of the tree becomes a question, classify who owns the answer.
Asking the wrong owner is the core failure mode of a naive interview.

| Type | Owner | What to do |
|---|---|---|
| **Fact** — code, docs, tests, or the web can answer it | Agent | Look it up; never ask. Dispatch a sub-agent when the lookup is slow, and keep asking the rest of the frontier meanwhile. |
| **Expertise** — stack, architecture, library, infra | Agent (per technical-decision mode) | Decide and justify: "I'll use X because Y — veto if you disagree." Never ask "which stack?" to someone who delegated. |
| **Taste** — UX direction, tone, feature priority; the user knows it when they see it | User, via reaction | Never an open question. Offer concrete contrasting options (previews, examples, references, cheap prototypes) and extract the criterion from the reaction. |
| **Scope** — who it's for, what's out, what success means | User | Ask directly, with a recommended default attached. |

## Frontier rounds

Work the tree in rounds.
The **frontier** is every decision whose prerequisites are already settled — askable now without guessing at answers you haven't heard yet.
Ask the whole frontier in one round; a question whose answer depends on another question still open this round belongs to a later round.
Each round the user answers reshapes the tree — recompute the frontier and go again.

Delivery, in order of preference:

1. **Structured question tool** (AskUserQuestion or equivalent) — batch up to 4 per call, recommended option first and labeled "(Recommended)", `multiSelect` for menus, previews for taste contrasts.
2. **Numbered markdown round** — when no structured tool exists or a question is too open for options: number each question, attach the recommended answer, wait for the batch of replies.

Every question, either way, carries a recommended answer.
A running fact-lookup is an unsettled prerequisite: only its downstream questions wait; ask the rest of the frontier now.

## Menu, not blank page

When the user lacks vision — features they haven't imagined, risks they haven't met — the agent **generates and the user curates**.
Research prior art and comparable tools, then present a menu: "tools like this usually have A, B, C, D — which belong in v1?" (`multiSelect`).
Same move for personas, non-goals, and risks.
An open question aimed at a user without the vision to answer it is a routing failure, not diligence.

## Assumptions over blocking

A low-risk unknown never blocks a round: pick a sensible default, label it as an assumption, and keep moving.
Collect labeled assumptions in the artifact; the user corrects them in bulk, not one interruption at a time.

## Domain language

Working inside a repo, compose with the `domain-modeling` skill: challenge fuzzy or overloaded terms as they surface, capture canonical terms in `CONTEXT.md`, and offer an ADR only for a decision that is hard to reverse, surprising without context, and a real trade-off.

## Done

The session is done when the frontier is empty — every branch resolved, defaulted-with-label, or explicitly out of scope — and the destination artifact is written with its assumptions visible.
Do not act on the artifact until the user confirms shared understanding.
Handing off to another agent afterwards → fill [templates/launch-packet.md](templates/launch-packet.md).
A long or multi-sitting session → keep [templates/session.md](templates/session.md) as the working ledger.
