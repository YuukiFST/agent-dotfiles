# Stress-testing an existing plan, spec, or PR

The plan is a **map**; the codebase, docs, and constraints are the **territory**.
This branch pressure-tests the map against territory evidence before anything is built or merged.

## Evidence first

Before any round, inspect the ground truth the plan touches:

- Official docs for every library/platform/API the plan relies on.
- Local source, routes, models, schemas, migrations, tests, config.
- Existing project conventions and similar implementations in the repo.
- Error logs, CI failures, issue comments, previous implementation notes.

If docs are missing but retrievable, fetch them.
If they cannot be accessed, say so and mark the claim unverified.

## What makes a question worth asking

Every question in a round must be all three:

- **Material** — the answer could change architecture, scope, UX, data model, security, permissions, or acceptance criteria.
- **Grounded** — it points at doc/source behavior or a concrete uncertainty, citing the evidence, not fishing for preferences.
- **Answerable** — the user can pick an option, approve a default, or supply a reference.

Never ask what the repo can answer; never dump an exhaustive questionnaire before research; never ask an open "anything else?".

## Question shape

Each frontier question in this branch carries:

```md
Question: <the decision>
Why it matters: <what changes if A vs B>
Evidence: <doc/source/test citation>
Recommended: <default + rationale>
```

## Verdict

The session ends with a verdict on the plan, not just answers: what holds, what the evidence contradicts, which assumptions were silently load-bearing, and the corrected plan leading with the decisions most likely to change — never burying architecture decisions under mechanical steps.
If implementation discovers the territory contradicts the map, the map updates — the plan is never treated as truth.
