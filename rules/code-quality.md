# Code quality (the reader is an LLM)

Token cost, tool-call latency, output quality — technical constraints, not style opinions. Applies to any non-trivial code writing.

- SRP, small functions: three 250-line modules beat one 800-line file doing three things.
- Flatten control flow: early returns / guard clauses; cap ~2 indent levels.
- Inject dependencies (constructor/parameter) so a named fake swaps in without infra.
- Tests run headless, one command — no manual seed, missing config, or secret.
- Formatter decides style (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`); never spend a turn on formatting.
- Structured (JSON) logs for debug/observability; plain text only for user-facing CLI output.
- Defensive code is opt-in: no retry/backoff, timeout, circuit-breaker, rate-limit, or fallback unless the project names the categories it needs.
- A broken lint, typecheck, or test found along the way gets fixed on the spot (global CLAUDE.md).
