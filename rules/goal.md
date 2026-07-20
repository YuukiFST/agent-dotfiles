# Goal compilation — Phase 0 for goal mode

Applies when the user invokes `/goal`, `$goal`, "goal mode", or hands an autonomous build objective (PRD-driven or free-form).
Run this BEFORE executing anything and BEFORE writing `GOAL.md` — the compiled contract governs the run, not the raw prompt.

## Premise

Humans write vague goals ("develop the project", "run all possible tests").
The raw prompt is *input* to the goal, never the goal itself.
Compile it into a verifiable contract first; every later decision traces back to that contract.

## Phase 0 — compile the contract

Produce these five sections, then execute against them:

1. **Objective** — one sentence, synthesized from the prompt plus the PRD/spec when one exists.
2. **Finishing criteria** — each criterion verifiable by a command or an observable artifact.
   - Bad: "all possible e2e tests pass". Good: "e2e suite covers every PRD flow; full suite green in one command; command and output recorded".
   - When a PRD exists, every PRD requirement becomes one demonstrable criterion — the PRD is the source of truth, the prompt only adds constraints on top.
3. **Out of scope** — what the run will NOT do, so silence in the prompt is not read as license.
4. **Priority order** — what gets sacrificed first if context, time, or blockers force a cut.
5. **Escape hatch** — the conditions that pause the run instead of guessing (spec contradicts repo, validation contradicts goal, looping without progress).

Rules while compiling:

- **Do not restate standing rules.** Security/quality closeout comes from `code-quality.md`, UI flow from `frontend.md` (opt-in), commit rules from `git.md`. A prompt that repeats them adds noise; a contract that repeats them drifts when the rules change. Reference, never copy.
- **Ambiguity:** autonomous run (user away) → resolve it yourself and record the decision in the ledger/notes; interactive session → at most one round of clarifying questions, then compile and go.
- **Ledger coupling:** where the harness has a goal ledger (goal-ledger plugin on Claude Code, pi-codex-goal on pi), the compiled contract IS the `GOAL.md` objective + finishing criteria. Write it there; the raw prompt is not stored as the goal anywhere.
- Show the compiled contract to the user in the first reply (a few lines, not a document) so a wrong compilation dies early.
