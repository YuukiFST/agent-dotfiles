# Feature

1. Read the affected subsystem to the depth of `investigation.md` step 1.
2. Name the data shape and its organizing structure (`principle-model-the-domain`); in a typed language, shape the types with `principle-type-system-discipline`.
3. Settle the design: a change crossing a module boundary, or one with several valid shapes, goes through `codebase-design`; an empirical fork goes to `prototype`; only a product call no experiment settles goes to the user.
4. Write the throughput checkpoint as four todo items, each kept with `n/a: <reason>` when it does not apply:
   - **Blocking first steps:** what must land before anything fans out.
   - **Independent workstreams:** disjoint files or layers that can run in parallel.
   - **Shared mutable state:** split the target first; serialize only for a real invariant.
   - **Smallest safe decomposition:** if one worker is best, say why.
5. Build in small units, each verified before the next (`principle-sequence-verifiable-units`).
   UI parts follow `ui-polish`; new tests pass `test-audit`.
6. Verify on the matching surface (`principle-prove-it-works`).
7. A contested design or risky change gets `interrogate` before it ships; ship through `git-workflow` when the user asked to ship.

**Reply:** what you built, what you chose and why, the throughput checkpoint, open decisions; a table when design alternatives were weighed.
