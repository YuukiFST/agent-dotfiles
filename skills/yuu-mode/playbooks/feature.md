# Feature

1. Read the affected subsystem to the depth of `investigation.md` step 1.
2. Write the acceptance criteria into the todo list, each a check a run settles (CLI output, HTTP response, browser flow), quoting the user where they stated it.
   A criterion only you inferred is marked assumed, and the tests it motivates stay out of the commit until the user approves (`~/.claude/CODING_STANDARDS.md`, "Human authority").
   A feature with several user-facing flows becomes one end-to-end slice per flow, each with its own criteria; the slice that rests on the least proven integration goes first.
   A feature that will not fit one session, or whose product questions span sessions, goes to `helmsman` instead.
3. Name the data shape and its organizing structure (`principle-model-the-domain`); in a typed language, shape the types with `principle-type-system-discipline`.
   A new or changed error, its message or its public shape follows `principle-error-design`.
4. Settle the design: a change crossing a module boundary, or one with several valid shapes, goes through `codebase-design`; an empirical fork goes to `prototype`; only a product call no experiment settles goes to the user.
   A choice that is hard to undo (data model, wire format, public API, migration) gets a read-only subagent before the first edit: give it the proposal and the constraints it must meet, never your conclusion, and ask how the proposal breaks them.
   A finding that comes from a misread constraint means the constraint was unclear: rewrite it and rerun, three runs at most.
   A feature touching auth, user input, secrets or payments also runs `security-audit`.
5. Build slice by slice, in small units each verified before the next (`principle-sequence-verifiable-units`).
   UI parts follow `ui-polish`; new tests pass `test-audit`.
6. Verify every acceptance criterion on the matching surface (`principle-prove-it-works`).
7. A contested design or risky change gets `interrogate` before it ships; ship through `git-workflow` when the user invoked `/git-workflow`.

**Reply:** what you built, each acceptance criterion with the evidence that it passes, what you chose and why, open decisions; a table when design alternatives were weighed.
