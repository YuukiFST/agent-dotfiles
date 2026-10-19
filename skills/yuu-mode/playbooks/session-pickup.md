# Session pickup

You own the resume point: read the prior trail and continue it, rather than redo it.
The trail is authoritative input; a pass that re-derives it from scratch treats it as untrustworthy.

1. Locate the trail: a handoff note the user names, a pushed branch or PR, or a transcript found by its session id.
   `find ~/.claude/projects -name '<session_id>.jsonl'` gives the transcript, and its subagents sit in `<that dir>/<session_id>/subagents/agent-*.jsonl`.
   No id given: ask for it or for the note; the newest transcript by mtime is this session, and the other project dirs hold unrelated private chats.
   Done when you hold the trail's path and the prior session's goal.
2. Read the last messages first, then scan back for the decision points.
   A long transcript goes to a read-only explore subagent (Subagents in `../SKILL.md`), and only its reduced timeline enters this session.
3. Reconstruct the operational state: the branch and worktree, what landed (`git log` and `git diff` against the base), the open todos and the decisions made.
4. Diff done against pending and name the resume point; completed work and the prior repro stay as they are.
   Done when every planned item is marked done, pending or dropped, each with the transcript line or commit behind it.
5. Route the remaining work through Routing in `../SKILL.md` with a new route line; that route owns the rest.
   Before building on an inherited claim of done, check it against the original goal on the real artifact (`principle-prove-it-works`); a prior self-report is not the proof.

**Reply:** where the prior session stopped, what you inherited versus redid (ideally nothing redone), the resume point, the route taken, and the outcome.
