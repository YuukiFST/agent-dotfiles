---
name: perf-ratchet
description: "Performance ratchet for any app (web, desktop, CLI, game, service): committed per-machine baselines for startup time, RAM, CPU, FPS, instruction count, bundle size or Web Vitals that no change may regress, and improvements become the new baseline. Use to set up baselines or a gate, when a project has .perf/ratchet.json and a change touches performance, to prove a change made nothing slower, or to choose a data-layout change or remove a cache in a hot path. Slow-page diagnosis goes to web-perf."
---

# Performance ratchet

A **ratchet** turns one way: every metric keeps its best proven value as the baseline, a change that makes any metric worse past its noise threshold is rejected, and a change that makes one better moves the baseline there.
Each release is then at least as fast as the one before it.

`ratchet.mjs` (Node 18+, no dependencies) holds the verdict, so it never rests on arithmetic done in your head.
Setup copies it, `probe.mjs` and `count.mjs` from this skill's `scripts/` into the project's `.perf/bin/`, so CI and every machine run the same gate without the skill installed; recopy them when this skill's copies change.
Run it from the project; it finds `.perf/` in the working directory or a parent.

| File in the project | Committed | Holds |
|---------------------|-----------|-------|
| `.perf/ratchet.json` | yes | The metrics: how each is measured, unit, direction, runs, tolerance |
| `.perf/baselines.json` | yes | Best proven median and noise per metric, one bucket per machine plus one `stable` bucket |
| `.perf/bin/` | yes | `ratchet.mjs`, `probe.mjs` and `count.mjs`, copied from this skill |
| `.perf/measure/` | yes | The project's own measurement scripts |
| `.perf/runs/` | no (`.perf/.gitignore`) | The latest samples and `report.md` |

## Setup

Done when `.perf/ratchet.json` covers every metric the user agreed to and the first `check` wrote `.perf/baselines.json`.

1. Detect the project type and propose metrics from [metrics.md](metrics.md), adding every area the user named ("FPS on tab X"); the user confirms the list before you write anything.
2. Copy `scripts/ratchet.mjs`, `scripts/probe.mjs` and `scripts/count.mjs` into `.perf/bin/`.
3. Write one measurement command per metric, or one per trace that yields several values (`pick`), under `.perf/measure/`.
   Each command must exit 0 and print the value on its last stdout line.
4. Write `.perf/ratchet.json`:

   ```json
   {
     "profile": "release",
     "metrics": [
       { "id": "startup.cold_ms", "command": "node .perf/measure/startup.mjs", "unit": "ms", "better": "lower", "runs": 7 },
       { "id": "idle.ram_mb", "command": "node .perf/bin/probe.mjs -- dist/app.exe", "pick": "rss_mb_peak", "unit": "MB", "better": "lower" },
       { "id": "idle.cpu_pct", "command": "node .perf/bin/probe.mjs -- dist/app.exe", "pick": "cpu_pct_mean", "unit": "%", "better": "lower", "minDelta": 1 },
       { "id": "home.lcp_ms", "unit": "ms", "better": "lower" },
       { "id": "bundle.js_kb", "command": "node .perf/measure/bundle.mjs", "unit": "KB", "better": "lower", "stable": true },
       { "id": "parse.instructions", "command": "node .perf/bin/count.mjs instructions -- target/release/cli parse fixtures/big.json", "pick": "instructions", "unit": "Ir", "better": "lower", "stable": true, "platforms": ["linux"] }
     ]
   }
   ```

   Field defaults: `runs` 5 (`stable` 1), `warmup` 0, `tolerance` 0.05 relative (`stable` 0), `minDelta` 0 absolute.
   `stable: true` marks a deterministic, machine-independent value (bundle or binary size, Valgrind instruction or heap count); it shares one baseline across machines and is the only kind CI gates.
   `platforms` limits a metric to the OSes its tool runs on (`count.mjs` needs Linux); other machines skip it and say so, and CI or a Linux machine gates it.
   A metric with no `command` is fed by hand with `record`.
5. Run `node .perf/bin/ratchet.mjs measure`, then `check`. With no baseline yet, every metric is `new` and becomes the baseline. Commit `.perf/`.

## Gate a change

Done when `check` exits 0 on the final code and the report sits in the commit or PR body.

Choosing what to change in a hot path, or about to add a cache: read [techniques.md](techniques.md) first.

1. Build the way `profile` says (release, production bundle), close what competes for the machine, and keep the power plan fixed.
2. `node .perf/bin/ratchet.mjs measure`, then `record <id> <value>...` for every hand-fed metric, then `check`.
   `check` refuses a run that skipped a configured metric; `--only a,b` narrows both commands while you iterate, and the final gate runs everything.
3. Read the verdict:
   - **regressed** (exit 1): fix the code or revert it. The baselines stay untouched, and no other metric is promoted while one is red.
   - **improved** or **new**: `check` already promoted it into `.perf/baselines.json`. Commit that file with the change.
   - **flat**: inside the threshold, so the old baseline stays and nothing drifts.
   - **reset**: the metric's unit or direction changed in the config; it restarts its baseline, and the report says why.
4. Before you claim a speedup, vet it with `principle-explain-the-number`.
5. Paste `.perf/runs/report.md` into the commit or PR body.

The threshold for both verdicts is the largest of `tolerance` times the baseline, twice the noise (1.4826 × MAD of the samples, base or current), and `minDelta`.

## Moving the ratchet backwards

Only the user moves it backwards.
Editing `baselines.json` by hand, raising a `tolerance`, deleting a metric or dropping a run from the gate each needs the user's explicit approval for that metric, named in the commit body.
A trade the user accepts (more RAM for a faster startup) is recorded the same way.

Noisy metric, threshold too wide to catch anything: raise `runs` or `warmup`, or fix the measurement (cold versus warm cache, background load); a wider tolerance hides regressions.

## Measuring by kind

- **Web pages:** the lab trace in `web-perf` (phase 3) yields LCP, CLS, TBT and, from an interaction trace, INP; `record` each value from three traces. Keep phone and desktop as separate metric ids.
- **Desktop launch:** `optimizing-startup` defines cold start and settled; its recording is the measurement behind `startup.*`.
- **RAM and CPU:** `probe.mjs` samples the app's whole process tree; recipes in [metrics.md](metrics.md).
- **Instructions and heap allocations:** `count.mjs` runs one program under Valgrind; low noise, so the best proof of a layout change, per [metrics.md](metrics.md).
- **FPS, frame time, interaction latency:** an in-app counter or a trace, per [metrics.md](metrics.md).

## Machines and CI

Every machine-bound metric is stored under a bucket keyed by OS, CPU, cores, RAM and `profile`, so a laptop never judges a desktop's numbers.
The first run on a new machine starts that machine's bucket and says so.
CI on shared runners gates only `stable` metrics: [ci.md](ci.md).
