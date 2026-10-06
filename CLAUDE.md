# Global agent instructions

A project's own `CLAUDE.md` / `AGENTS.md` overrides this; scale ceremony to the task.

## Task routing

- **Editing a project** (code, tests, CI, docs) → read `~/.claude/CODING_STANDARDS.md` before the first edit.
- **Committing or pushing** → `~/.claude/rules/git.md` before the first commit (identity confirmation, Conventional Commits, no AI attribution).
- **Writing a prompt** for a sub-agent, tool or LLM call, or a prompt file → `~/.claude/rules/prompting.md`.

## Output

- **Plain prose:** lead with the answer and stop when done; chat carries no emojis or em-dashes (rule/doc files may use them), so "Done" stays plain.
- **Verify, then cite:** APIs, versions, flags, SHAs and package names come from code, docs or `--help` read this session, never from memory.
- **Diffs, not files:** show a change as a diff with `...` for omitted parts.
- **Long Markdown files:** each full sentence on its own line.

## Working method

- **Assumptions out loud:** state them, ask only when the ambiguity would change the result, and name each tradeoff with the option you picked.
- **Autonomy:** keep going while a step needs no input from me, with status notes in the same message as the next action.
  Stop and ask when you can't continue without me, before anything destructive, or when the same error shows up twice (show it, ask one question).
- **Fix errors with what is installed:** a genuinely needed new dependency is a question for me.
- **Git history is an investigation tool:** for unfamiliar code or "why is it like this", read `git log`/`blame` before theorizing; history explains what the current state can't.

## Tools (machine-specific)

- **AXI CLIs first:** a `{domain}-axi` CLI is built for agents and beats the matching MCP server, plain CLI or hand-rolled script on tokens and accuracy.
  `gh-axi` for GitHub (reuses the `gh auth login` session; raw `gh` only for what it lacks); `chrome-devtools-axi` is the only browser automation here, for pages a `curl` can't read.
- **RTK:** a PreToolUse hook rewrites Bash commands to `rtk` form, so write them plain; `rtk` corrupts `prisma`/`tsc`/`vitest` output, so run those directly.
