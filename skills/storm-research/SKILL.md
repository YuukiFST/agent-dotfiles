---
name: storm-research
description: Use when the user wants deep multi-angle research on a topic, a briefing before a decision/interview/investment/negotiation/presentation, to map where experts disagree, or says "research X", "STORM this", "give me the full picture on X". Not for quick factual lookups.
disable-model-invocation: true
---

# STORM Research

## Overview

Stanford STORM (Synthesis of Topic Outlines through Retrieval and Multi-perspective Question Asking, NAACL 2024) catches blind spots a single prompt misses by asking from 5 expert angles, mapping their contradictions, synthesizing, then self-critiquing. Run all 4 phases in sequence on the user's topic — the user supplies only the topic (and optionally their role); you run the method.

## When to Use

- User asks to research / understand / get briefed on any non-trivial topic
- Before a decision, interview, investment, negotiation, presentation, or article
- User wants to know where the experts actually disagree

**Not for:** quick factual lookups ("what's the capital of X"), code questions, or anything answerable in one line.

## Inputs

- **Topic** (required) — whatever the user wants to know.
- **Role** (optional) — the user's role, for the actionable-insight step. Missing → infer from context or write a generic "someone acting on this".

## Workflow — run all 4 phases, in order, in one response

Produce four clearly-headed sections. Do not stop after one. Do not ask permission between phases. If web search is available, use it to ground claims; otherwise reason from knowledge and flag in Phase 4 what would need verification.

### Phase 1 — Multi-Perspective Scan

Simulate 5 expert perspectives on the topic. For EACH: core position (2 sentences), strongest supporting evidence, and the one thing only this voice would say.

1. **Practitioner** — works with this daily. What do academics miss? What practical realities get ignored?
2. **Academic** — studied it for years. What does peer-reviewed evidence actually say? Where does it contradict popular belief?
3. **Skeptic** — thinks the mainstream is wrong. Strongest counterargument? What do proponents conveniently ignore?
4. **Economist** — follows the money. Who profits from the current narrative? What incentives shape the research?
5. **Historian** — has seen the pattern before. What parallels exist? How did those play out?

### Phase 2 — Contradiction Map

From the 5 perspectives:
1. Where do 2+ perspectives directly contradict? List each clash with the specific claims.
2. Which perspective has the strongest evidence? Which the weakest? Why?
3. The one question that, if answered, would resolve the biggest contradiction.
4. What every perspective agrees on (likely true — even opponents confirm it).
5. What NONE addressed (the field's blind spot — often the most valuable finding).

### Phase 3 — Synthesis Briefing

1. **One-paragraph summary** — brief a CEO with 60 seconds who needs nuance, not the headline.
2. **5 key findings** — ranked by reliability; for each note which perspectives support and which challenge it.
3. **Hidden connection** — one non-obvious link visible only across all 5 perspectives.
4. **Actionable insight** — what should someone in [role] do differently? Be specific.
5. **Frontier question** — the one question that would change how we understand this.

### Phase 4 — Peer Review

Grade your own briefing (STORM's known weakness is no self-critique):
1. **Confidence scores** — rate each of the 5 key findings 1–10 for reliability, explain each.
2. **Weakest link** — which claim are you least confident in? What would verify it?
3. **Bias check** — which perspective is overrepresented? Did one voice dominate?
4. **Missing perspective** — a 6th angle that would change the conclusions?
5. **Overall grade** — what grade would a Stanford professor give, and what to fix?

## Common Mistakes

- Stopping after Phase 1 or 3 — all 4 phases run every time, in one pass.
- Asking the user to confirm between phases — don't; only ask up front if the topic is too vague to research.
- Letting one voice dominate — Phase 4 bias check exists to catch this; honor it.
- Inventing a role — if unknown, write generically, don't guess the user's job.
