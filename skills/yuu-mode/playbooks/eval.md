# Eval

Measure whether a change to a skill, playbook or prompt changes what an agent does: the deliverable is a verdict on the variant, not the change itself.
Each run is a headless `claude -p` session, graded from its transcript, never from what its reply says it did.

1. Frame the variant under test, the baseline it replaces (usually `main`), and the behavior that counts as success.
   Write 3-6 rubric criteria a transcript can settle (a file read, a skill invoked, a line in the reply) and keep the rubric out of every candidate's view.
   Done when each criterion reads as pass or fail with no judgment call, or is marked as the one a judge settles (step 6).
2. Build one plugin dir per arm, a `kit/` inside its own fresh `mktemp -d`: `kit/.claude-plugin/plugin.json` holding `{"name":"kit"}`, and `kit/skills/` holding that arm's whole `skills/` (`git archive <ref> skills | tar -x -C kit`, or `cp -r skills kit/` for an uncommitted variant), so relative routes resolve inside the arm.
   An installed `~/.claude/skills/<name>` shadows a project `.claude/skills/<name>` of the same name, so the variant loads as a plugin and runs as `/kit:<name>`.
   Give each run its own working dir with a project-shaped name holding what the organic task needs (a skeleton, a git repo), in a fresh `mktemp -d` of its own.
   A run sees the parent of its plugin dir and of its working dir, and walks up into it: a shared parent shows it the other arms and runs.
3. Write one organic prompt: what a user would type, free of eval, judge, rubric, compare, candidate and variant, with no request to list the skills or files used.
   A prompt that caps the reply's length can trip a skill's casual-question shortcut; size it to the behavior under test.
4. Run each arm at least twice on the same prompt and model, since a single run per arm is noise:
   `MSYS_NO_PATHCONV=1 claude -p "/kit:<name> <prompt>" --plugin-dir "$(cygpath -w <kit dir>)" --permission-mode <mode> --output-format json --max-budget-usd <cap>`
   From Git Bash, `MSYS_NO_PATHCONV=1` keeps the leading `/` from becoming a Windows path and `cygpath -w` hands Claude Code a path it can open; drop both elsewhere.
   Use `plan` as the mode when the behavior under test is read-only, so a run cannot edit its working dir.
   Record each run's `session_id` and `total_cost_usd` from the JSON.
5. Grade each run from `~/.claude/projects/<cwd slug>/<session_id>.jsonl`, found by `session_id`; the newest file by mtime is your own session.
   Tool calls are the `type: "tool_use"` entries of `message.content` on `type: "assistant"` lines: check the files read, the skills invoked and the reply against each criterion.
   A model-invoked skill (a `principle-*`) can load from the installed copy instead of `kit:`; a run that did so never exercised the variant, so that criterion is inconclusive for it.
6. A criterion no transcript check settles goes to one judge subagent on a model alias the runs did not use, given the rubric and every output under a neutral label (`A1`, `B2`) in a single pass.
   Read every output yourself; a judge you disagree with means a biased judge or an ambiguous criterion, so name which.
7. Delete the arm dirs, the working dirs, their `~/.claude/projects/<cwd slug>` transcript dirs and any `~/.claude/plans/` file a `plan`-mode run wrote, once the verdict is written.

**Reply:** variant under test, rubric, a pass/fail table per run and criterion, total cost, and whether to promote the variant.
