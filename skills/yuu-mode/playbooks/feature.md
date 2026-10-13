# Feature

1. Read the affected subsystem to the depth of `investigation.md` step 1.
2. Name the data shape and its organizing structure (`principle-model-the-domain`); in a typed language, shape the types with `principle-type-system-discipline`.
3. Settle the design: a change crossing a module boundary, or one with several valid shapes, goes through `codebase-design`; an empirical fork goes to `prototype`; only a product call no experiment settles goes to the user.
   A feature touching auth, user input, secrets or payments also runs `security-review`.
4. Build in small units, each verified before the next (`principle-sequence-verifiable-units`).
   UI parts follow `ui-polish`; new tests pass `test-audit`.
5. Verify on the matching surface (`principle-prove-it-works`).
6. A contested design or risky change gets `interrogate` before it ships; ship through `git-workflow` when the user asked to ship.

**Reply:** what you built, what you chose and why, open decisions; a table when design alternatives were weighed.
