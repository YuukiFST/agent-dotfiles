# Refactoring

The structure changes; the behavior does not.
A missing feature or a real bug found along the way is split out: the structural change ships first against the pinned contract, and a redesign is named and re-routed to the feature playbook.

1. Pin the behavior first: a characterization test, snapshot or equivalence harness that captures current behavior before any structure moves.
   Type check and lint are not a pin.
2. Name the structure the code is missing (`principle-model-the-domain`); the reshape must delete branches or invalid states, not add indirection.
3. Name the target shape: module layout, types and call graph as if built today. A target crossing a module boundary goes through `codebase-design`.
4. Subtract before you add: delete dead code, collapse one-caller wrappers and drop orphan references before the new shape goes in.
5. Move in small steps that each keep the pin green. An API reshape migrates every caller and deletes the old API in the same wave, with no shim.
   Grep every rename across code, strings and docs; renames miss usages there.
6. Prove behavior is unchanged on the real artifact (`principle-prove-it-works`): the pin, plus an old-versus-new output diff for a larger reshape.
7. Keep the change only if it lowers reader load somewhere; otherwise revert it.
8. Commit in order: the subtraction, then the reshape, then any follow-on cleanup (`principle-sequence-verifiable-units`); ship through `git-workflow` when the user asked to ship.

**Reply:** the structure that changed, the pin it held against, the equivalence proof, the reader-load delta, and what shipped versus what was reverted.
