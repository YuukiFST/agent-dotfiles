---
name: principle-prove-it-works
description: "Apply before claiming work is done, fixed, or passing, and before committing or opening a PR. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, a self-report, or 'it compiles'."
---

# Prove it works

Verify every task output by checking the real thing directly. Do not infer from proxies, self-reports, or "it compiles."

**Why:** Unverified work has unknown correctness. Indirect verification (file mtimes, output freshness, agent self-reports, cached screenshots) feels cheaper than direct observation. Acting on a wrong inference costs far more than checking the source.

Check the real thing, not a proxy:
- Run the command that proves the claim in this turn and read its output before stating the claim. A claim with no output behind it is a guess. Say so.
- Check process liveness directly, not indirectly through derived state
- Read the actual value, not a cached or derived representation
- A subagent's "done" is a self-report. Read the diff or the artifact it names.
- When verification fails, suspect the observation method before suspecting the system

## Script the check when you can

The strongest proof is a deterministic script that re-runs the same comparison, not a one-time eyeball. Write the script, run it, and keep its output as an artifact a reviewer can re-run instead of trusting your word.

Work in several units checks each unit before the next: [Sequence Verifiable Units](../principle-sequence-verifiable-units/SKILL.md).

Source: [pstack](https://github.com/cursor/plugins/tree/main/pstack/skills/principle-prove-it-works), MIT, see `LICENSE`.
