---
name: perf-ratchet
description: "The one entry for performance work on any app (web, desktop, Android, CLI, game, service), measured in microseconds: page load and Web Vitals, launch, quit, typing, scrolling, idle RAM and CPU, FPS, instruction count, bundle size, with committed per-machine baselines that no change may regress and improvements become the new baseline. Use for anything slow, laggy, janky or heavy, to make an app or site faster, to set up baselines or a gate, when a project has .perf/ratchet.json and a change touches performance, to prove a change made nothing slower, or to choose a data-layout change or remove a cache in a hot path."
---

# Performance ratchet

A **ratchet** turns one way: every metric keeps its best proven value as the baseline, a change that makes any metric worse past its noise threshold is rejected, and a change that makes one better moves the baseline there.
Each release is then at least as fast as the one before it.

Every performance request runs the same cycle, on a project of any size, in this order: Setup when the project has no `.perf/ratchet.json`, Make it faster, Gate a change.
The baseline is recorded before the first change to the code; a speedup measured by a throwaway script is lost with the script.

`ratchet.mjs` (Node 18+, no dependencies) holds the verdict and the speedup, so neither rests on arithmetic done in your head.
Setup copies every `.mjs` in this skill's `scripts/` except the test into the project's `.perf/bin/`, so CI and every machine run the same gate without the skill installed; recopy them when this skill's copies change.
Run it from the project; it finds `.perf/` in the working directory or a parent.

| File in the project | Committed | Holds |
|---------------------|-----------|-------|
| `.perf/ratchet.json` | yes | The metrics: how each is measured, unit, direction, runs, tolerance, resolution |
| `.perf/baselines.json` | yes | Best proven median and noise per metric plus its first recorded value, one bucket per machine plus one `stable` bucket |
| `.perf/bin/` | yes | `ratchet.mjs` (gate), `launch.mjs` (launch, quit and in-app scenarios), `probe.mjs` (RAM and CPU), `count.mjs` (Valgrind) |
| `.perf/measure/` | yes | The project's own measurement scripts |
| `.perf/runs/` | no (`.perf/.gitignore`) | The latest samples and `report.md` |

## What makes a number true

- **Microseconds:** every time metric has unit `us` and an id ending in `_us`, printed as an integer; `ratchet.mjs` refuses `ms` and `s`.
- **Monotonic clock:** read time from the clock [metrics.md](metrics.md) names for the language; a wall clock (`Date.now()`) ticks in milliseconds and jumps.
- **Name the event, not the wish:** an id says what the code observed (`first_frame_us` is the frame handed to the compositor), and each metric has a start event, an end event and a fixed fixture.
- **Declare the resolution:** a metric whose source cannot see below some step (a webview clock, CPU-time ticks, a display refresh) carries that step as `resolution`, and the gate treats a smaller change as flat.
- **Count work where you can:** file calls per 100 keystrokes is the same number on every run, so it catches what a timing hides in noise.
- **Speedups come from the report:** quote "5.9x faster" from the `Speedup` and `Since first` columns, which stay empty for a change inside the threshold.

## Setup

Done when `.perf/ratchet.json` covers every metric the user agreed to and the first `check` wrote `.perf/baselines.json`.
A target that cannot run on this machine (an Android app with no device attached, a missing toolchain) still gets steps 1 to 4, then Setup stops: the report says no baseline was recorded, names what is missing and lists the fixes the code suggests as unmeasured.
A number from another host or an emulator is never a sample.

1. Detect the project type and propose metrics from [metrics.md](metrics.md), adding every area the user named ("FPS on tab X").
   For a desktop, web or Android app, answer every row of its checklist: proposed, or not applicable with the reason.
   The user confirms the list before you write anything; in a run with nobody to answer, go on with the whole checklist and list the metrics in the report.
2. Copy the scripts into `.perf/bin/`.
3. Write one measurement command per metric, or one per run that yields several values (`pick`), under `.perf/measure/`.
   Each command must exit 0 and print the value on its last stdout line.
4. Write `.perf/ratchet.json`:

   ```json
   {
     "profile": "release",
     "metrics": [
       { "id": "launch.first_frame_us", "command": "node .perf/bin/launch.mjs --quit -- dist/app.exe", "pick": "first_frame_us", "unit": "us", "better": "lower", "runs": 7, "resolution": 30 },
       { "id": "launch.read_state_us", "command": "node .perf/bin/launch.mjs --quit -- dist/app.exe", "pick": "read_state_us", "unit": "us", "better": "lower", "runs": 7 },
       { "id": "quit.gone_us", "command": "node .perf/bin/launch.mjs --quit -- dist/app.exe", "pick": "quit_us", "unit": "us", "better": "lower", "runs": 7 },
       { "id": "typing.state_file_calls_per_100", "command": "node .perf/measure/typing.mjs", "pick": "state_file_calls", "unit": "calls", "better": "lower", "stable": true },
       { "id": "idle.private_mb", "command": "node .perf/bin/probe.mjs --settle 5 --duration 30 -- dist/app.exe", "pick": "private_mb_mean", "unit": "MB", "better": "lower" },
       { "id": "bundle.js_kb", "command": "node .perf/measure/bundle.mjs", "unit": "KB", "better": "lower", "stable": true },
       { "id": "home.lcp_us", "unit": "us", "better": "lower" }
     ]
   }
   ```

   Field defaults: `runs` 5 (`stable` 1), `warmup` 0, `tolerance` 0.05 relative (`stable` 0), `minDelta` 0 absolute, `resolution` 0 absolute.
   `stable: true` marks a deterministic, machine-independent value (a count of work, bundle or binary size, Valgrind instruction or heap count); it shares one baseline across machines and is the only kind CI gates.
   `platforms` limits a metric to the OSes its tool runs on (`count.mjs` needs Linux); other machines skip it and say so, and CI or a Linux machine gates it.
   A metric with no `command` is fed by hand with `record`.
5. Run `node .perf/bin/ratchet.mjs measure`, then `check`. With no baseline yet, every metric is `new` and becomes the baseline. Commit `.perf/`.

## Make it faster

Done when the metric the user cares about improved in `check` and no other metric regressed.

1. Measure first: the baseline is the `check` before any change.
2. Attribute: split the slow metric into spans and counts until one part owns most of it; a profile or trace names the hot code inside that part.
3. One change, `measure`, `check`, keep it or revert it.
   Launch work: [launch.md](launch.md). A hot path, or about to add a cache: [techniques.md](techniques.md). A web page: the `web-perf` audit.
4. Repeat from 2 on the next largest part.

## Gate a change

Done when `check` exits 0 on the final code and the report sits in the commit or PR body.

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

The threshold for both verdicts is the largest of `tolerance` times the baseline, twice the noise (1.4826 × MAD of the samples, base or current), `minDelta` and `resolution`.

## Moving the ratchet backwards

Only the user moves it backwards.
Editing `baselines.json` by hand, raising a `tolerance`, deleting a metric or dropping a run from the gate each needs the user's explicit approval for that metric, named in the commit body.
A trade the user accepts (more RAM for a faster launch) is recorded the same way.

Noisy metric, threshold too wide to catch anything: raise `runs` or `warmup`, or fix the measurement (cold versus warm cache, background load); a wider tolerance hides regressions.

## Machines and CI

Every machine-bound metric is stored under a bucket keyed by OS, CPU, cores, RAM and `profile`, so a laptop never judges a desktop's numbers.
The first run on a new machine starts that machine's bucket and says so.
CI on shared runners gates only `stable` metrics: [ci.md](ci.md).
