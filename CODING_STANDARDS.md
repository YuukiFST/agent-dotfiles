# CODING_STANDARDS.md — Global

Code rules that override model defaults, read before writing or changing code in any project via the pointer in the global `CLAUDE.md`.

The reader is an LLM: token cost, tool-call latency and output quality are technical constraints here, not style opinions.

- **Before a helper:** grep for the canonical one, reuse it.
- **File > 500 lines = decompose first**, don't append. SRP, small functions: three 250-line modules beat one 800-line file doing three things.
- **Flatten control flow:** early returns / guard clauses; cap ~2 indent levels.
- **Grep-able names:** avoid `data`/`handler`/`Manager`/`Service` — a name returning 50 grep hits is wrong.
- **Types explicit:** no `any`, no `@ts-ignore`, no `as X` papering over an invariant, no `T | undefined` on always-set fields.
- **Inject dependencies** (constructor/parameter) so a named fake swaps in without infra.
- **Formatter decides style** (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`); never spend a turn on formatting.
- **Structured (JSON) logs** for debug/observability; plain text only for user-facing CLI output.
- **Defensive code is opt-in:** no retry/backoff, timeout, circuit-breaker, rate-limit, or fallback unless the project names the categories it needs.
