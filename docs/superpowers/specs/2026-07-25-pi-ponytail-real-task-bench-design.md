# Pi ponytail real-task benchmark — design

Date: 2026-07-25
Status: approved for implementation (brainstorm)
Repo: `benchmarks/pi-ponytail`

## Problem

The existing `benchmark-pi.js` suite is single-shot toy codegen (~30–50 LOC).
It measures LOC / total tokens / seconds, and already has a light `correctPass` gate, but:

1. Total tokens are dominated by harness + system-prompt overhead, so small tasks always look worse with ponytail.
2. Pass rate is not printed in the summary table, so it looks like there is no success metric.
3. Toy tasks do not answer the real question: does ponytail save **total tokens** on a **real** coding task without degrading functional quality?

## Goal

Prove or disprove, on Cursor-backed `pi`:

> Ponytail reduces **total tokens** on a realistic multi-file task **without lowering `pass%`** vs baseline.

Primary metric: `pass%` (oracle test suite).
Secondary (only meaningful when `pass=1`): `totalTokens`, then `src_loc` / seconds.

## Non-goals (v1)

- Full Claude Code agentic suite from upstream `.vendor/ponytail/benchmarks/agentic/` (different engine).
- LLM-as-judge for style / over-engineering (can add later).
- Installing ponytail into the live `~/.pi/agent` settings; arms inject prompts only.
- Many fixtures; v1 ships **one** task.

## Approach (chosen)

**B — Fixture repo + hidden oracle tests + agentic `pi` session with tools.**

Rejected for v1:

- **A** single-shot large module: still artificial; agent does not edit a tree.
- **C** unbounded multi-turn freeform: high variance/cost; harder to attribute.

Upstream agentic README is inspiration only; this design targets **pi + Cursor models**.

## Architecture

```
benchmarks/pi-ponytail/
  fixtures/url-shortener/     # visible to agent (stubs + ticket)
  oracle/url-shortener/       # hidden tests; harness copies AFTER agent exits
  references/url-shortener/
    good/                     # must pass oracle (--selftest)
    bad/                      # must fail oracle (--selftest)
  arms/                       # reuse existing baseline / ponytail arms
  benchmark-pi-real.js        # new runner (keep toy benchmark-pi.js)
  README.md                   # document both runners
```

### Per-cell flow

1. Copy `fixtures/url-shortener/` to a fresh temp workdir; `git init` + initial commit (for `git diff` LOC).
2. `npm install` in workdir (or use a pre-cached `node_modules` copy for speed).
3. Spawn `pi -p` with:
   - `cwd` = workdir
   - tools **enabled** (read / write / edit / bash as pi exposes); skills/context-files/prompt-templates off
   - `--append-system-prompt` = arm system prompt only
   - env: `CAVEMAN_DEFAULT_MODE=off`, `PONYTAIL_DEFAULT_MODE=off`
   - user prompt = ticket text (from fixture README or `TASK.md`)
4. Parse JSON stream for usage (`totalTokens` or input+output+cache) and wall-clock seconds.
5. Copy `oracle/url-shortener/` into workdir (agent never saw these files).
6. Run `npm test` (Vitest). `pass = exit 0`.
7. Record `src_loc` = added lines from `git diff` on `src/**` only (exclude tests/oracle).
8. Delete workdir (optional keep on `--keep-failed`).

### Arms

Same as toy bench:

| Arm | System prompt |
|-----|----------------|
| `baseline` | none (suffix only if needed for agentic discipline) |
| `ponytail-default` | full raw `skills/ponytail/SKILL.md` |
| `ponytail-full` | `getPonytailInstructions('full')` |

No global ponytail install. Isolation must not leak user plugins into baseline (mirror upstream contamination lesson: only arm prompt differs).

### Agentic prompt suffix

Unlike toy bench ("single fenced block, no tools"), real runner **must allow tools**.
Suffix should be short and arm-neutral, e.g.:

> Implement the ticket in this repo. Edit files in place. Do not invent extra features. Stop when the ticket is done.

Do **not** tell the agent about the oracle or to write the hidden tests.

## Fixture (v1): URL shortener

Stack: Node + TypeScript + Vitest + Hono (fewer deps than Express; fixed choice for v1).

Visible tree (stubs with `NotImplementedError` / TODO):

- `src/store.ts` — in-memory store interface + empty impl skeleton
- `src/validate.ts` — URL validation stub
- `src/shortener.ts` — create/resolve short codes stub
- `src/http.ts` — `POST /shorten`, `GET /:code` stubs
- `package.json`, `tsconfig.json`, `vitest.config.ts` (test script points at paths that only exist after oracle copy, or harness injects config)
- `TASK.md` — ticket for the agent

Ticket requirements (must be testable):

1. `POST /shorten` with `{ "url": "..." }` returns `{ "code": "..." }`.
2. `GET /:code` redirects (302/307) to original URL, or 404 if unknown.
3. Reject invalid URLs (non-http(s), empty, `javascript:`, whitespace-only) with 400.
4. Distinct URLs get distinct codes.
5. Persist in process memory for the lifetime of the app instance.

Target good solution size: ~150–300 LOC across 3–5 source files.

### Oracle (hidden)

Tests import the app factory / handlers (fixture must export a testable `createApp()` or equivalent — stub exports already exist so agent fills them in).

Cases:

- Happy path: shorten → resolve → same URL
- Invalid URL → 400
- Unknown code → 404
- Two different URLs → two different codes
- Reject `javascript:alert(1)` and URL without http(s) scheme

### References + selftest

Before any model call, `node benchmark-pi-real.js --selftest` must:

1. Apply `references/url-shortener/good/` onto a fresh fixture copy → oracle passes.
2. Apply `references/url-shortener/bad/` (happy path only, skips validation / 404) → oracle fails.

If selftest fails, exit non-zero and spend zero API tokens.

## Metrics and report

Per cell store: `{ arm, task, rep, pass, totalTokens, inputTokens?, outputTokens?, srcLoc, elapsedSec, reason }`.

Printed summary:

1. **pass / total** and **pass%** per arm (primary).
2. Median **totalTokens** among **passing** cells only; vs baseline % (secondary).
3. Median **src_loc** among passing cells; vs baseline.
4. Median seconds (all cells or passing — report both; default: all for cost, passing for quality-conditioned economy).

Decision rule (documented in README):

- Ponytail "helps" only if `pass% >= baseline` **and** median totalTokens (passing) `<` baseline.
- If `pass%` drops → quality regression; ignore LOC/token wins.
- If `pass%` holds but tokens rise → compression does not pay for itself on this task size / model.

JSON output: `benchmark-pi-real-results.json`.

## Runner CLI

```bash
# verify oracle before spend
node benchmark-pi-real.js --selftest

# run
node benchmark-pi-real.js \
  --model cursor/grok-4.5 \
  --repeat 3 \
  --arms baseline,ponytail-default,ponytail-full
```

Flags: `--model`, `--repeat`, `--arms`, `--pi-cwd`, `--keep-failed`, `--selftest`, `--help`.

Reuse `setup.sh` / `.vendor/ponytail` for arm instruction loading.
Keep `benchmark-pi.js` unchanged for the toy suite.

## Error handling

- `pi` non-zero: cell `pass=false`, reason=`pi exit`, tokens if parseable else 0.
- Timeout (default 10 minutes/cell): kill process, fail cell.
- Oracle timeout: fail cell.
- Missing exports / TypeScript build failure: fail cell with reason from compiler/test stderr (truncate).

## Testing the harness (not the model)

- `--selftest` (good/bad references) is mandatory CI/local gate.
- Optional smoke: one real cell with `--repeat 1 --arms baseline` after selftest.

## Risks

| Risk | Mitigation |
|------|------------|
| Agent runs `npm test` early and sees nothing / wrong paths | Oracle absent until after session; ticket never mentions oracle |
| Agent deletes stubs or renames exports | Oracle imports stable public API documented in stubs |
| Tools disabled by mistake | Real runner must not pass `--no-tools` |
| Baseline contaminated by global ponytail | Env off + no skills; only append-system-prompt arm file |
| Token telemetry only totals | Prefer split input/output when pi JSON provides it; still report total |

## Success criteria for this project

Implementation is done when:

1. `--selftest` passes.
2. One documented command runs the three arms.
3. Summary table shows pass% and tokens-vs-baseline conditional on pass.
4. README explains how to interpret "ponytail helps / hurts".

## Out of scope follow-ups

- More fixtures (rate-limit, CSV pipeline, React feature).
- Completeness / over-engineering LLM judges (upstream has these).
- Cache-amortized multi-turn accounting.
