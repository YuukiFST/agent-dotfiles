---
name: handoff
description: Compact the current conversation into a handoff prompt that a fresh session pastes in to continue the work.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

Write a handoff document so a fresh agent, in a new session or another harness, continues the work without asking the user to re-explain it.
The usual trigger is a context window filling up.
The next agent starts cold and trusts every line, so the document is its whole memory of this session.

If the user passed arguments, treat them as what the next session will focus on and keep the reasoning that bears on it.

## Steps

1. **Read the live state.** In each repo the work touched, run `git branch --show-current`, `git status --short` and `git log --oneline -5`.
   Outside a git repo, list the files the session created or changed.
   Done when you hold the branch, the uncommitted files and the last commit.
2. **Write the document** from the template below, in the conversation's language, to `<tmp>/handoff-<repo>-<slug>.md`.
   `<tmp>` is `$TMPDIR`, else `/tmp`; `%TEMP%` on Windows.
   Temp keeps the handoff out of the workspace and out of git.
   Drop a section that has nothing to say rather than filling it.
3. **Audit every claim.** Each statement of fact is either verified, citing the command, test or `file:line` that showed it this session, or tagged _unverified_ (in the document's language).
   A belief written as fact becomes a false premise for everything the next agent does.
   Done when no claim lacks evidence or the tag.
4. **Hand it over.** Reply with the absolute path and a paste-ready prompt in a code block, in the conversation's language:

   ```text
   Read <absolute path> and continue the work it describes. Confirm "State" with git before editing, then start at "Next steps".
   ```

   When the user asked for the prompt itself instead of a file, put the whole document in the code block and skip the file.
   Tell the user to paste the prompt into the new session as typed text: interpolated into a shell command like `claude "<prompt>"`, backticks and `$(...)` get expanded and the brief arrives silently truncated.

## Template

```markdown
# Handoff: <task in one line>

## Goal
What done looks like for the whole task, and why it matters.

## State
Repo, branch, uncommitted files, last commit, and what is mid-edit right now.

## Done
Finished items, each with its evidence.

## Decisions
Each choice made, why, and the alternatives rejected with the reason.

## Dead ends
Approaches tried that failed, with the error or reason, so the next agent skips them.

## Next steps
Ordered; each ends on a completion criterion the next agent can check.

## Open questions
What still needs the user, and assumptions nobody confirmed.

## References
Specs, plans, ADRs, issues, PRs, commits and files, by path or URL.

## Suggested skills
Skills the next agent should call the Skill tool for, and at which step.
```

## Rules

- **Point, don't copy:** anything already written down (specs, plans, ADRs, issues, commits, diffs) appears as a path or URL, so the settled detail lives in one place.
- **Carry the why:** Decisions and Dead ends hold the reasoning this session paid for; the diff already shows the what.
- **Redact:** API keys, tokens, passwords and personal data stay out; name where a secret lives (an env var, a file) instead.
- **Live thread only:** the document is a small fraction of the conversation, the work in flight and not a transcript of how it got there.

Done when someone with no access to this session can read the document cold and start the first of the Next steps.
