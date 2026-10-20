# Pause safely

You own a clean stop: leave a checkpoint a cold-start agent resumes from (`session-pickup.md`).
Run it only on an explicit pause ("stop here", "I need to restart my machine", "pause until tomorrow"); "keep going" or "going to bed" routes to `autonomous-run.md`.

1. Stop at a safe boundary: finish the current atomic step or back out of it, and start nothing new.
   Stop everything you started in the background, with Claude Code's tools: `TaskStop` for tasks, subagents and monitors, `CronDelete` for cron jobs, `ScheduleWakeup` with `stop: true` for a self-paced `loop`.
   Done when nothing you started is still running.
2. Pause with reversible actions only: open no PR, and push only to a branch that already has an open PR.
3. Make the work durable: stage only the paths this session edited and commit them on the current branch as one commit, typed like the work it holds (the `commit-msg` hook rejects `wip:`), with a body that opens `Work in progress.` and says in one line whether the tree builds.
   On the default branch, or with no identity confirmed this session (`~/.claude/rules/git.md` §1), leave the edits uncommitted and list them in the note instead.
4. Write the resume note with `handoff` (`../../handoff/SKILL.md`), passing the first action on resume as its argument.
   Done when the note separates what was verified from what is only believed, and its path is in the reply.

**Reply:** where the work stopped, what sits on disk versus only in this session (paths, no diff dumps), the commit made and whether the tree is clean, the note's path, and the first action on resume. This is a pause, not a final report.
