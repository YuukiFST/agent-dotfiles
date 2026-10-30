# Autonomous run

You own the exit condition: define done, then drive to it while the user is away.
The stop rules in the Autonomy section of `../SKILL.md` still hold; everything they leave reversible is yours to do.

1. State the exit condition as a predicate you can check by running something (tests green, repro gone, every listed PR merged, pixel diff zero) before the first iteration.
   Beside it, name a progress measure the same command reports that moves before the predicate flips (failing tests left, PRs still open).
   No commit identity confirmed this session (`~/.claude/rules/git.md` §1): confirm it before the user leaves; if they are already gone, iterations stay uncommitted, each kept pass staged so a revert restores the index, and each becomes a row in the todo list.
   Done when the predicate, the progress measure and the command that checks both are in the todo list.
2. Waiting on something outside the session (CI, a merge, a ref advancing) gets a wake mechanism; the tools named here are Claude Code's.
   One event: Bash with `run_in_background` and an `until` loop that exits on it; a stream of events: `Monitor` with a command that prints every terminal state, failures included.
   A long fallback heartbeat covers a watch that hangs: the `loop` skill without an interval, which self-paces through `ScheduleWakeup`.
   No event to watch: `loop` with a fixed interval sized to when the result is worth re-checking.
3. Each iteration runs the secondary route's steps as its body, so copy them into the todo list under this step (bug-fix: repro, root cause, fix, verify).
   At the end of the pass, run the check: keep the pass if the progress measure moved, committed when step 1 confirmed an identity, and revert the whole pass if it did not, so a failing repro and the fix it waits on stand or fall together.
   Progress made by deleting, skipping or loosening a check the predicate or progress measure reads, or by adding a suppression, does not count, so revert that pass too, unless the removal is what the secondary route is for (a `test-audit` sweep).
   A test whose expected value looks wrong is the user's call (`~/.claude/CODING_STANDARDS.md`, "Human authority"), so it becomes a question row as in step 4, unless the change the user asked for is what contradicts it: that counts as approval, so update it and name it in the reply.
   A change that only "might help" is reverted, not left to ride; order the units with `principle-sequence-verifiable-units`.
   Done when the iteration has its row in the todo list: what changed, and the measure and the predicate before and after.
4. Mid-run discoveries that support the goal are yours: a broken skill (Non-negotiables in `../SKILL.md`), a related bug, a flaky check, a tooling failure.
   Fix each on its own local branch, list the branch in the reply, and return to the predicate; opening its PR follows the Autonomy section.
   A question only the user can answer, a product or preference call no experiment settles, becomes a row in the todo list, and work continues on whatever does not depend on it.
5. Stop when the predicate holds.
   A plateau is not a stop: change approach and push past it; a real dead end gets named with its evidence, and the predicate stays as stated.

**Reply:** the exit condition, the iteration rows, what landed, what was reverted, the local branches holding side fixes, the open questions, and the final predicate state with the output that checks it.
