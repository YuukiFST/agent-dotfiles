# CLAUDE.md — Global

Cross-project guidance. Lean by design: only what's non-obvious or machine-specific. Project `CLAUDE.md` overrides this; for generic best-practice, trust the model. For trivial tasks, judgment over ceremony.

## Output

- Concise output, thorough reasoning. No sycophantic openers/closers; in chat prose no emojis and no em-dashes (rule/doc files may use them). Plain "Done", never "✅ Done".
- Never guess APIs, versions, flags, SHAs, or package names — verify in code/docs first.
- Don't print full files back; show diffs with `...` for omitted parts.
- Long Markdown files: each full sentence on its own line.
- Never manually modify CHANGELOG.md or files marked auto-generated.
- **Don't prune an agent's own comments on refactor** — they carry intent/provenance. Comment the *why* (bug, upstream constraint, issue#/SHA), never the obvious *what*. Docstrings on public functions: intent + one usage example.

## Working method

- State assumptions; if ambiguous, ask before coding. Surface tradeoffs, don't pick silently.
- Simplest code that solves it; surgical diffs; match existing style. Remove only orphans *your* change created; flag pre-existing dead code, don't delete it.
- Turn tasks into verifiable goals; refactors keep existing tests green before and after.
- **Debugging loop:** produce fix → run tests/lint → repair only failures → repeat. Run lint/typecheck on your own output before showing it.
- Same error twice → stop, show error, ask one question. Never install packages to fix errors.
- **Bug fixes:** reproduce E2E first, as the end user experiences it — find the real problem, not a symptom.
- See a lint/test failure or flake → fix it, even if unrelated to your change. UI work: fix visible pixel issues along the way.
- **Standardize for agent automation:** same command does the same thing across projects (`bin/deploy`, tag-release, layout) so an agent runs "deploy" without guessing.
- **Repeat issue → automate, don't re-fix:** same class of problem seen twice (style, API misuse, missing check) → propose a lint rule, CI step, or hook that kills the class forever; never rely on fixing it per-occurrence.
- **Review rejection = missing rule:** a PR rejected for an unwritten convention means the convention gets encoded (CLAUDE.md, lint, skill) as part of resolving the rejection.
- README leads with the problem it solves (one sentence, top); stack/architecture go in `docs/`.

## Code rules (override model defaults)

- **Before a helper:** grep for the canonical one. Duplicating an existing helper is a failure, not a nit.
- **File > 500 lines = decompose first**, don't append.
- **Grep-able names:** avoid `data`/`handler`/`Manager`/`Service` — a name returning 50 grep hits is wrong.
- **Types explicit:** no `any`, no `@ts-ignore`, no `as X` papering over an invariant, no `T | undefined` on always-set fields.
- **Tests:** regression test per bugfix. Mock external I/O with named fakes.

## Tools (machine-specific)

- **gh-axi for GitHub ops** (subcommands `issue`/`pr`/`run`/`workflow`/`release`/`repo`/`label`/`search`/`api`) over plain `gh` — ~50% fewer tokens. Uses the existing `gh auth login` session; raw `gh` only for what gh-axi lacks.
- **RTK:** a PreToolUse hook auto-rewrites Bash commands to `rtk` form — don't manually prefix. Known break: `rtk` corrupts `prisma`/`tsc`/`vitest` output — run those directly.

## Conditional rules (read the file only when the task matches, otherwise skip)

- **Writing or refactoring code beyond a trivial fix** → `~/.claude/rules/code-quality.md` (SRP, flat control flow, DI, headless tests, formatter, structured logs, defensive-code-opt-in).
- **Writing prompts for sub-agents/tools/LLM calls, or maintaining prompt files** → `~/.claude/rules/prompting.md`. Agent workflow strategies: `~/.claude/rules/agent-best-practices.md`.
- **Effect-TS code** (project depends on `effect`; writing/refactoring workflows, services, layers, schemas, `Config`, `Schedule`, `Cache`, `Stream`, `HttpClient`, or Effect tests) → load the `effect` skill BEFORE writing code, and read only the branch references the task matches. Requires Effect v4 — on v3 or older, skip it and follow the project's own conventions.
- **Committing or pushing** → `~/.claude/rules/git.md` FIRST (commit identity confirmation, Conventional Commits, no-AI-attribution). Not committing → skip.
