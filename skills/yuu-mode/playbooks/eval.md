# Eval

Measure whether a change to a user-invoked skill or a playbook changes what an agent does: the deliverable is a verdict on the variant, not the change itself.
Each run is a headless `claude -p` session invoked as `/kit:<name>`, graded from its transcripts, never from what its reply says it did.
A model-invoked skill's description or trigger, and the global `CLAUDE.md`, `rules/` and `CODING_STANDARDS.md`, get no variant arm from this setup: say so and stop rather than issue a verdict.

1. Frame the variant under test, the baseline it replaces (usually `main`), the model alias every run uses, and the behavior that counts as success.
   Write 3-6 rubric criteria a transcript can settle (a file read, a skill invoked, a line in the reply); the rubric lives only in your session.
   Done when each criterion reads as pass or fail with no judgment call, or is marked as the one a judge settles (step 6).
2. Write one organic prompt: what a user would type, free of eval, judge, rubric, compare, candidate and variant, with no request to list the skills or files used.
   A prompt that caps the reply's length can trip a skill's casual-question shortcut; size it to the behavior under test.
3. Run each arm at least twice, one run at a time: a run walks up out of its own dirs and reads whatever sits there, so no other run's files may exist while it runs.
   1. Build its plugin dir, a `kit/` in a fresh `mktemp -d`: `kit/.claude-plugin/plugin.json` holding `{"name":"kit"}`, and `kit/skills/` holding the arm's whole `skills/` (`git archive <ref> skills | tar -x -C kit`, or `cp -r skills kit/` for an uncommitted variant), so relative routes resolve inside the arm.
      An installed `~/.claude/skills/<name>` shadows a project `.claude/skills/<name>` of the same name; the plugin's `kit:` namespace is what lets the arm's copy load.
   2. Build its working dir in another fresh `mktemp -d`, with a project-shaped name and what the organic task needs (a skeleton, a git repo).
   3. From the working dir run:
      `MSYS_NO_PATHCONV=1 claude -p "/kit:<name> <prompt>" --plugin-dir "$(cygpath -w <kit dir>)" --model <alias> --permission-mode <mode> --output-format json --max-budget-usd <cap>`
      From Git Bash, `MSYS_NO_PATHCONV=1` keeps the leading `/` from becoming a Windows path and `cygpath -w` hands Claude Code a path it can open; drop both elsewhere.
      Use `plan` as the mode when the behavior under test is read-only, so the run cannot edit its working dir.
   4. Grade it (step 4) and clean it up (step 5) before the next run starts.
   Done when each arm has its runs with `is_error: false`; a run with `is_error: true` (`subtype: "error_max_budget_usd"` when it hit the cap) is inconclusive and runs again.
4. Grade from the transcripts named by the run's `session_id`; the newest transcript by mtime is your own session.
   `find ~/.claude/projects -name '<session_id>.jsonl'` gives the main transcript, and the calls its subagents made sit in `<that dir>/<session_id>/subagents/agent-*.jsonl`.
   Tool calls are the `type: "tool_use"` entries of `message.content` on `type: "assistant"` lines: check the files read, the skills invoked and the reply against each criterion.
   The run's `result` holds only its final text block; a line written earlier in the turn sits in the `type: "text"` entries of `message.content`.
   A `Skill` call whose `skill` lacks the `kit:` prefix, or a read under `~/.claude/skills/`, exercised the installed copy instead of the arm, so that criterion is inconclusive for the run.
   Done when every criterion holds pass, fail or inconclusive for the run, each with the transcript entry behind it.
5. Clean up by literal path, resolved and checked before the `rm`: the run's two `mktemp -d` dirs, the transcript dir holding `<session_id>.jsonl` once `find` printed exactly one match, and each `~/.claude/plans/` file the run's `Write` calls name.
   A path built from an empty lookup resolves to the wrong tree (`dirname ""` is `.`).
6. A criterion no transcript check settles goes to one judge subagent on a model alias the runs did not use, given the rubric and every output shuffled under opaque labels (`R1` to `Rn`) in a single pass; the label map stays with you.
   Read every output yourself; a judge you disagree with means a biased judge or an ambiguous criterion, so name which.
7. Decide under `principle-explain-the-number`: promote when the variant passes every success criterion on all of its runs and the baseline failed the targeted criterion on all of its runs.
   Any mixed result means more runs or an inconclusive verdict.

**Reply:** variant under test, model, rubric, a pass/fail/inconclusive table per run and criterion, total cost, and whether to promote the variant.
