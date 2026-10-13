# Investigation

Read-only: the deliverable is a cited answer or a recommendation, never a code change.

1. Locate the code. Read a known file directly; send a sweep across many files to a read-only explore subagent.
   Done when every claim you plan to make has a file:line or a command output behind it.
2. For "why is it like this", read `git log` and `git blame` on the lines before forming a theory.
3. Write the answer: Overview, Key concepts, How it works, Where things live (file:line), Gotchas.
   A choice between alternatives becomes a recommendation with a tradeoffs table.
4. A flow with three or more moving parts gets a `show-me` diagram; a request to see the idea gets `anatomy`.

The moment the question turns into a code change, say so and re-route to the bug-fix or feature playbook.

**Reply:** the answer. For "are we sure?", give your real judgment with reasons, and push back when the premise is wrong.
