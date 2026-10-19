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
Prose follows the conversation's language; template headings, the _unverified_ tag and the quoted heading names in the prompt stay in English, so the prompt and the document agree on them.

## Steps

1. **Pick the mode.** Inline when the user asked for the prompt itself instead of a file ("send me the prompt", "inline"); file otherwise.
   A mode request in the arguments is not focus text.
2. **Read the live state.** In each repo the work touched, run `git rev-parse --show-toplevel`, `git status` and `git log --oneline -5`.
   The long form of `git status` carries the upstream, ahead/behind and any rebase, merge or cherry-pick in progress.
   Outside a git repo, list the files the session created or changed.
   Done when you hold the worktree path, the branch (or detached HEAD), whether it is pushed, the uncommitted files, any operation in progress and the last commit.
3. **Write the document** from the template below.
   File mode writes it to `<tmp>/handoff-<repo>-<slug>-<YYYYMMDD-HHMM>.md`: `<repo>` is the basename of the worktree path (`session` outside git), `<slug>` the task line in kebab-case.
   `<tmp>` is `%TEMP%` on Windows, else `$TMPDIR`, else `/tmp`; temp keeps the handoff out of the workspace and out of git.
   Inline mode writes no file.
   Drop a section that has nothing to say rather than filling it.
4. **Audit every claim.** A statement of fact counts as verified only with evidence gathered after the last edit to what it covers: the command, test or `file:line` that showed it.
   Rerun a cheap check whose evidence went stale; tag the rest _unverified_.
   A belief written as fact becomes a false premise for everything the next agent does.
   Done when no claim lacks fresh evidence or the tag.
5. **Hand it over.**
   - **File mode:** reply with the absolute path in the OS's native form (`C:\...` on Windows; from Git Bash, `cygpath -w <path>`) and this prompt in a code block:

     ```text
     Read <absolute path> and continue the work it describes. Confirm "State" with git before editing, then start at "Next steps".
     ```

   - **Inline mode:** reply with one code block fenced with more backticks than any fence inside the document (four when it holds a triple-backtick block).
     Its first line is the instruction `Continue the work this brief describes. Confirm "State" with git before editing, then start at "Next steps".`, then the document.
     Tell the user to paste it into the new session as typed text: inside a shell argument like `claude "<prompt>"`, backticks and `$(...)` in the brief run as commands.

## Template

```markdown
# Handoff: <task in one line>

## Goal
What done looks like for the whole task, and why it matters.

## State
Worktree path, branch, push status, uncommitted files, operation in progress, last commit, and what is mid-edit right now.

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
Skills the next agent should load, and at which step; for a user-invoked skill, write "ask the user to run /<name>".
```

## Rules

- **Point, don't copy:** anything already written down (specs, plans, ADRs, issues, commits, diffs) appears as a path or URL, so the settled detail lives in one place.
- **Carry the why:** Decisions and Dead ends hold the reasoning this session paid for; the diff already shows the what.
- **Redact:** API keys, tokens, passwords and personal data stay out; name where a secret lives (an env var, a file) instead.
- **Live thread only:** the document is a small fraction of the conversation, the work in flight and not a transcript of how it got there.

Done when someone with no access to this session can read the document cold and start the first of the Next steps.
