# State machine audit

Read-only until the user confirms a finding: the deliverable is a state model of existing code and a ranked list of invalid states it can reach.
Read `principle-model-the-domain` and `principle-make-operations-idempotent` first; they name what a sound model and a safe retry look like.

1. Inventory every state machine in scope: explicit ones (an enum, a status column, a reducer) and implicit ones (booleans that must agree, phase fields, files or rows whose presence marks progress, lifecycle callbacks).
   Send a sweep across many files to a read-only explore subagent.
   Done when each machine has a name and the file:line of every place that reads or writes its state.
2. Document all of them in one file: per machine, its states, the invariants each state holds, and a transition table (from, event, guard, to, file:line).
   Done when every write found in step 1 maps to a row of some table, and a write with no row is listed as a finding.
3. Find the invalid states and transitions the code can reach, each with evidence: a run, a test, a log, or a file:line trace a reader can follow.
   Walk retries (the step crashes halfway and runs again) and concurrency (two runs, requests or workers interleave on the same state), not only the happy order.
   Done when every invariant from step 2 is either shown to hold, with the reason, or broken by a named sequence of events.
4. Rank the findings by impact (data loss or corruption, then a stuck or wrong user-visible state, then cosmetic), and group those sharing one root cause into one issue each.
5. For each issue, show the model before and after the proposed fix with `show-me`: the current transitions with the invalid path marked, beside the model that makes it unreachable.
6. A finding becomes a regression test only after the user confirms it is a bug (`~/.claude/CODING_STANDARDS.md`, "Human authority"); each confirmed fix then runs `bug-fix.md`.

**Reply:** the model file's path, each issue ranked with its evidence and its before/after diagram, and which findings the user has confirmed.
