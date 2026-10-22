# Refactoring

The structure changes; the behavior does not.
A missing feature or a real bug found along the way is split out: the structural change ships first against the pinned contract, and a redesign is named and re-routed to the feature playbook.

1. Pin the behavior before any structure moves: the existing E2E suite where it covers the path, otherwise a golden-master E2E run (`test-audit` gates it).
   Type check and lint are not a pin.
2. Name the structure the code is missing (`principle-model-the-domain`); the reshape must delete branches or invalid states, not add indirection.
3. Name the target shape: module layout, types and call graph as if built today. A target crossing a module boundary goes through `codebase-design`.
4. Subtract before you add: collapse one-caller wrappers inside the refactor's scope before the new shape goes in; report dead code outside that scope instead of deleting it.
5. Move in small steps that each keep the pin green. An API reshape migrates every caller and deletes the old API, and whatever else the move orphaned, in the same wave, with no shim.
   Grep every rename across code, strings and docs; renames miss usages there.
6. Prove behavior is unchanged on the real artifact (`principle-prove-it-works`): the pin, plus an old-versus-new output diff for a larger reshape.
7. A reshape you chose stays only if it lowers reader load somewhere; for one the user asked for that does not, say so with the evidence and ask before keeping or reverting.
8. Commit in order: the subtraction, then the reshape, then any follow-on cleanup (`principle-sequence-verifiable-units`); ship through `git-workflow` when the user invoked `/git-workflow`.

**Reply:** the structure that changed, the pin it held against, the equivalence proof, the reader-load delta, and what shipped versus what was reverted.
