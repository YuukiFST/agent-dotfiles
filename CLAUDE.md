# CLAUDE.md — Global

Project `CLAUDE.md` overrides this. For trivial tasks, judgment over ceremony.

## Output

- No sycophantic openers/closers; in chat prose no emojis and no em-dashes (rule/doc files may use them). Plain "Done", never "✅ Done".
- Never guess APIs, versions, flags, SHAs, or package names — verify in code/docs first.
- Don't print full files back; show diffs with `...` for omitted parts.
- Long Markdown files: each full sentence on its own line.
- Never manually modify CHANGELOG.md or files marked auto-generated.

## Working method

- State assumptions; ask before coding only when the ambiguity would change the result. Surface tradeoffs, don't pick silently.
- **Autonomy:** when a step doesn't need my input, keep going; put status notes in the same message as the next action. Stop and ask only when you can't continue without me, or before anything destructive.
- Same error twice → stop, show error, ask one question. Never install packages to fix errors.
- **Git history is an investigation tool:** unfamiliar code, or "why is this like this" → `git log`/`blame` before theorizing; the history tells the story the current state can't.
- See a lint/typecheck/test failure or flake → fix it, even if unrelated to your change. UI work: fix visible pixel issues along the way.
- **Standardize for agent automation:** same command does the same thing across projects (`bin/deploy`, tag-release, layout) so an agent runs "deploy" without guessing.
- **Repeat issue → automate, don't re-fix:** same class of problem seen twice (style, API misuse, missing check) → propose a lint rule, CI step, or hook that kills the class forever; never rely on fixing it per-occurrence.
- **Review rejection = missing rule:** a PR rejected for an unwritten convention means the convention gets encoded (CLAUDE.md, lint, skill) as part of resolving the rejection.
- README leads with the problem it solves (one sentence, top); stack/architecture go in `docs/`.

## Tools (machine-specific)

- **[AXI](https://github.com/kunchenguid/axi) CLIs first** — `{domain}-axi` tools are built for agents: fewer tokens and higher task accuracy than the equivalent MCP server or plain CLI. Prefer one over an MCP server or a hand-rolled script whenever it covers the domain.
- **gh-axi for GitHub ops** (subcommands `issue`/`pr`/`run`/`workflow`/`release`/`repo`/`label`/`search`/`api`) over plain `gh`. Uses the existing `gh auth login` session; raw `gh` only for what gh-axi lacks.
- **chrome-devtools-axi for anything needing a real browser** (`open`/`snapshot`/`click`/`fill`/`eval`/`console`/`network`/`screenshot`/`lighthouse`) — the only browser automation on this machine. Skip it when `curl` is enough. Read `chrome-devtools-axi <command> --help` for current usage; never trust a remembered flag.
- **RTK:** a PreToolUse hook auto-rewrites Bash commands to `rtk` form — don't manually prefix. Known break: `rtk` corrupts `prisma`/`tsc`/`vitest` output — run those directly.

## Task routing

- **Writing code or tests** → read `~/.claude/CODING_STANDARDS.md` first.
- **Writing prompts for sub-agents/tools/LLM calls, or maintaining prompt files** → `~/.claude/rules/prompting.md`.
- **Building a screen/component or improving how an existing one looks and feels** → skill `ui-polish` (any stack, no package; routes over the design references in `~/.claude/ui-refs/`, never read those references directly).
- **Committing or pushing** → `~/.claude/rules/git.md` FIRST (commit identity confirmation, Conventional Commits, no-AI-attribution). Not committing → skip.
