# Autonomous run

You own the exit condition: define done, then drive to it while the user is away.
The stop rules in the Autonomy section of `../SKILL.md` still hold; everything they leave reversible is yours to do.

1. State the exit condition as a predicate you can check by running something (tests green, repro gone, every listed PR merged, pixel diff zero) before the first iteration.
   Done when the predicate and the command that checks it are in the todo list.
2. Waiting on something outside the session (CI, a merge, a ref advancing) gets a wake mechanism.
   One event: Bash with `run_in_background` and an `until` loop that exits on it; a stream of events: `Monitor` with a command that prints every terminal state, failures included.
   A long fallback heartbeat covers a watch that hangs: the `loop` skill without an interval, which self-paces through `ScheduleWakeup`.
   No event to watch: `loop` with a fixed interval sized to when the result is worth re-checking.
3. Each iteration makes the smallest change the evidence justifies, checks it against the predicate, commits it if the predicate moved and reverts it if not.
   A change that only "might help" is reverted, not left to ride; order the units with `principle-sequence-verifiable-units`.
   Done when the iteration has its row in the todo list: what changed, and the predicate before and after.
4. Mid-run discoveries are yours: a broken skill (Non-negotiables in `../SKILL.md`), a related bug, a flaky check, a tooling failure.
   Fix each on its own local branch, list the branch in the reply, and return to the predicate; opening its PR follows the Autonomy section.
   A question only the user can answer, a product or preference call no experiment settles, becomes a row in the todo list, and work continues on whatever does not depend on it.
5. Stop when the predicate holds.
   A plateau is not a stop: change approach and push past it; a real dead end gets named with its evidence, and the predicate stays as stated.

**Reply:** the exit condition, the iteration rows, what landed, what was reverted, the local branches holding side fixes, the open questions, and the final predicate state with the output that checks it.
