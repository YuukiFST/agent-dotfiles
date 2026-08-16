# Pi ponytail benchmark

Compare **baseline** (no ponytail), **ponytail-default** (raw `SKILL.md`), and **ponytail-full** (pi extension injection) using `pi -p` and any Cursor model — no Anthropic API key.

Two runners:

| Runner | Task type | Metric |
|--------|-----------|--------|
| `benchmark-pi.js` | Single-shot toy codegen (5 tasks) | LOC, tokens, seconds |
| `benchmark-pi-real.js` | Multi-file agentic task (URL shortener) | **pass%** (oracle), tokens, LOC, seconds |

## Setup (once)

```bash
cd ~/Projects/my-harness-config/benchmarks/pi-ponytail
chmod +x setup.sh
./setup.sh
```

## Toy runner (`benchmark-pi.js`)

```bash
# quick smoke (1 rep, ~15 min on composer-2-5)
node benchmark-pi.js --model cursor/composer-2-5 --repeat 1

# another model
node benchmark-pi.js --model cursor/grok-4.5 --repeat 3
```

Single fenced code block, no tools. Measures LOC / tokens / seconds per task.

## Real-task runner (`benchmark-pi-real.js`)

Agent gets a fixture repo with stubs + TASK.md, edits files using pi tools (read/write/edit/bash). After session, hidden oracle tests run to determine pass/fail.

```bash
# verify oracle before spending tokens
node benchmark-pi-real.js --selftest

# run benchmark
node benchmark-pi-real.js \
  --model cursor/grok-4.5 \
  --repeat 3 \
  --arms baseline,ponytail-default,ponytail-full
```

Flags: `--model`, `--repeat`, `--arms`, `--selftest`, `--keep-failed`, `--help`.

### Per-cell flow

1. Copy `fixtures/url-shortener/` to temp workdir, `git init`
2. `npm install` in workdir
3. Spawn `pi -p` with tools enabled (no skills/context/prompt-templates)
4. Agent edits stubs to implement the URL shortener
5. Copy `oracle/url-shortener/` tests into workdir (agent never saw these)
6. `npm test` (Vitest) — exit 0 = pass
7. Count `src/` LOC from `git diff`

### Metrics

- **pass%** per arm (primary — functional correctness)
- **Median totalTokens** among passing cells (secondary — cost efficiency)
- **Median src_loc** among passing cells
- **Median seconds** (all cells for cost, passing for quality)

### Decision rule

- `pass%` drops vs baseline → **quality regression** (ignore token wins)
- `pass%` ok + tokens down → **ponytail helps**
- `pass%` ok + tokens same/up → compression does not pay for this task size/model

## Arms

| Arm | Meaning |
|-----|---------|
| `baseline` | No ponytail system prompt |
| `ponytail-default` | Full raw `skills/ponytail/SKILL.md` |
| `ponytail-full` | `getPonytailInstructions('full')` — what pi extension injects |

Benchmark disables caveman/ponytail env overrides (`CAVEMAN_DEFAULT_MODE=off`, `PONYTAIL_DEFAULT_MODE=off`). Real runner uses `--no-skills --no-context-files --no-prompt-templates` so only the arm system prompt differs.

## Output

- Table printed to stdout
- `benchmark-pi-real-results.json` — full cell-level data + verdicts

## Notes

- Token numbers include pi/Cursor harness overhead; compare **relative** arms on the same model/run.
- For stable medians use `--repeat 3` or higher.
- `--selftest` must pass before any model call; it validates the good/bad references against the oracle with zero API cost.
- `--keep-failed` preserves failed workdirs in `/tmp` for debugging.
