# Bug fix

Every shipped line traces to runtime evidence.
A change that "might help" is a hypothesis: it ships only after evidence confirms it, and evidence that refutes it reverts what it motivated.

1. Reproduce it yourself on the surface the user hits (see Non-negotiables in `../SKILL.md`).
   Ask the user to reproduce only with a specific reason that surface is out of reach, after driving it as far as it goes; a bug that won't fire gets a synthesized trigger, tighter conditions or instrumentation.
   Done when you hold the failing output.
2. Read `principle-fix-root-causes`. Binary-search the cause: list the hypotheses, seed them with `git log` and `git blame` on the area, and each pass take the split that cuts the most remaining space, get runtime evidence, eliminate.
   Done when one mechanism survives, confirmed at runtime.
3. Two fixes sharing one premise failed the same check: read `principle-attack-the-premise` before a third.
4. Write the repro as a failing end-to-end test (`test-audit` gates it), then the smallest fix the evidence justifies.
   A fix that crosses a module boundary gets `codebase-design` first; a visual or motion defect takes its fix's craft bar from `ui-polish`.
5. Verify on the same surface: the original repro now passes.
6. Order the commits so the failing repro lands before the fix (`principle-sequence-verifiable-units`); ship through `git-workflow` when the user asked to ship.

**Reply:** what broke, the root cause, the fix, how you verified it, with the failing-then-passing output verbatim.
