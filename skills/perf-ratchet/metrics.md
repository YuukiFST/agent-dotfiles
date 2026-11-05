# Metric catalog and recipes

Propose from the row matching the project, then add every area the user named.
Each metric id names the place and the quantity (`tab_x.fps_p5`, `search.latency_ms`), so a report line reads without the config.
Take every tool flag below from the tool's own `--help` before the first run.

## What to propose

| Project | Propose |
|---------|---------|
| Web app or site | LCP, CLS and TBT per key route (phone and desktop as separate ids), INP for the main interaction, JS, CSS and font bytes per route (`stable`) |
| Desktop app (Electron, Tauri, native) | Cold startup to settled, idle RAM and CPU after settle, peak RAM on the heaviest screen, FPS on animated or scrolling screens, latency of the main interaction, installer or binary size (`stable`) |
| Game or canvas-heavy UI | Frame time p95 and FPS p5 per scene, load time per scene, peak RAM |
| CLI | Wall time of the main commands on a fixed input, peak RAM, binary size (`stable`) |
| Service or API | p50 and p95 latency per key endpoint under a fixed load, throughput, RAM at steady state; with a database, queries per request (`stable`) and the scale sweep below |
| Any | Build time, when the user cares about it; test-suite time is a `minDelta` metric, never `stable` |

Prefer a low percentile for FPS (`fps_p5`) and a high one for frame time and latency (`p95`): a mean hides the stutter users feel.

## Recipes

### RAM and CPU of an app

`probe.mjs` launches the command, waits `--settle` seconds, samples the process tree every `--interval` seconds for `--duration`, kills the tree, and prints `{"rss_mb_peak","rss_mb_mean","cpu_pct_mean","samples"}`.
Point two metrics at the same command with different `pick` keys; `measure` runs a shared command once per run.

```
node .perf/bin/probe.mjs --settle 5 --duration 10 -- dist/app.exe
node .perf/bin/probe.mjs --pid 1234 --duration 10
```

- RSS (Linux) and working set (Windows) count pages shared between processes once per process, so a multi-process app reads high; the ratchet compares like with like, so the trend is what counts.
- A window under 10 s makes `cpu_pct_mean` noisy on Windows, where each sample is a CIM query.
- RAM on a specific screen needs the app driven there first: a startup flag or deep link, or `--pid` against an app you drove by hand or with a UI driver.

### Instructions and heap allocations

`count.mjs` runs one program under Valgrind on Linux (WSL counts) and prints one JSON line:

```
node .perf/bin/count.mjs instructions -- target/release/cli parse fixtures/big.json   # {"instructions":N}
node .perf/bin/count.mjs heap -- target/release/cli parse fixtures/big.json           # {"heap_bytes":N,"heap_blocks":N,"heap_peak_bytes":N}
```

- Valgrind simulates the CPU, so the same binary and input give the same count run after run: mark these `stable` with `platforms: ["linux"]`, and `runs` 1 is enough.
- A toolchain change (compiler, libc, Valgrind version) moves the counts without any code change; pin the versions in CI, and treat the jump as a baseline reset the user approves.
- The program runs 20 to 50 times slower under Valgrind: give it a fixed input that finishes in seconds, not the full workload.
- Hardware counters (`perf stat -e instructions,cache-misses`) are cheaper but machine-bound, and GitHub's hosted runners expose none, so they stay on a local Linux gate.
- Wall time still decides whether users feel it: an instruction count that drops while the time metric stays flat is real work saved, not yet a felt speedup.

### Startup time

`optimizing-startup` owns the definition (cold, settled, interactive) and the recording.
Wrap its measurement in `.perf/measure/startup.*` so the last stdout line is the settled ms, and give it `runs` 7 or more: cold starts are the noisiest metric here.

### FPS and frame time

- **Web:** run a `requestAnimationFrame` counter in the page during the scripted scroll or animation (`chrome-devtools-axi eval`), print the frame deltas, and report `fps_p5` and `frame_ms_p95`; or read frames from a `perf-start --no-reload` trace.
- **Desktop or game:** an in-app frame counter behind a flag or environment variable that prints the percentiles after a fixed scripted sequence is the most repeatable source.
  On Windows, PresentMon captures present intervals from outside the app.
- Fix the window size and the content shown; FPS depends on both.

### Web Vitals

Run the `web-perf` lab trace (phase 3) three times per route and profile, then `record` each value: `ratchet.mjs record home.lcp_ms 1840 1910 1795`.
A script that drives `chrome-devtools-axi` and prints `{"lcp_ms":..,"cls":..}` turns this into a `command` with `pick`.
Field data (CrUX, RUM) is never a ratchet sample: it lags by weeks and mixes many releases.

### Interaction latency

Script the interaction (UI driver, `chrome-devtools-axi click`, an HTTP request) and time from input to the settled result, printed by the app or read from a trace.
A timer around a function call measures the function, not what the user waits for.

### Database at scale

A scale sweep shows which queries break as data grows, which a fixed fixture cannot.

1. Take the real queries from the code and the real relationships from the schema.
2. Seed one database per scale (`x10`, `x100`, `x1000`, as far as the machine holds), multiplying every relationship from a fixed random seed.
   Keep the production skew, such as a few huge tenants: uniform data hides the plan that fails.
   Run `ANALYZE` after seeding, and reuse the database across runs.
3. One script per scale prints each query's latency as JSON on its last line, read by one metric per query and scale: `{ "id": "sidebar.p95_ms.x100", "command": "node .perf/measure/db.mjs x100", "pick": "sidebar_p95_ms", "unit": "ms", "better": "lower", "warmup": 2 }`.
4. Fix first the query whose time grows faster than its data between two scales: 10x the rows and 30x the time is superlinear.
   `EXPLAIN (ANALYZE, BUFFERS)` on the largest scale shows why.

For `db.queries_per_request`, count the queries one fixed request issues against one fixed seed.
The count takes no timing, so mark it `stable`, and CI catches a new N+1.

### Sizes (`stable`)

Sum the built artifacts after a production build: JS and CSS per route from the bundler's stats file, the installer or binary from the filesystem.
Font bytes per route count the files the loaded page requests (`chrome-devtools-axi network --type font`), since `unicode-range` decides which ones download.
Same input gives the same bytes on every machine, so these gate in CI too.
Check that first: a build that differs between Windows and Linux (line endings, path strings) makes the size machine-bound, so drop `stable` for it.
