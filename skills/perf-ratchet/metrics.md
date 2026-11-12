# Metric catalog and recipes

Propose from the row matching the project, then add every area the user named.
Each metric id names the place and the quantity (`tab_x.fps_p5`, `search.latency_us_p95`), so a report line reads without the config.
Take every tool flag below from the tool's own `--help` before the first run.

## What to propose

| Project | Propose |
|---------|---------|
| Web app or site | Every row of the web checklist below |
| Desktop app (Electron, Tauri, native) | Every row of the desktop checklist below |
| Android app | Every row of the Android checklist below |
| Game or canvas-heavy UI | Frame time p95 and FPS p5 per scene, load time per scene, peak RAM |
| CLI | Wall time of the main commands on a fixed input, peak RAM, binary size (`stable`) |
| Service or API | p50 and p95 latency per key endpoint under a fixed load, throughput, RAM at steady state; with a database, queries per request (`stable`) and the scale sweep below |
| Any | Build time, when the user cares about it; test-suite time is a `minDelta` metric, never `stable` |

Prefer a low percentile for FPS (`fps_p5`) and a high one for frame time and latency (`p95`): a mean hides the stutter users feel.

## Desktop checklist

Answer every row in the proposal: the metric ids you propose, or "not applicable" with the reason (no saved state, no text input).
A row left out is a regression nobody will see.

| Area | Metrics | From, to | Source |
|------|---------|----------|--------|
| Launch, phases | `launch.pre_main_us`, `launch.window_us`, `launch.first_frame_us`, `launch.content_us`, `launch.interactive_us` | Process creation to: the entry point's first statement, the window shown, the first frame handed to the compositor, the first frame holding the content the user came for (not a skeleton), the final frame with input focus set | `launch.mjs` marks |
| Launch, where it goes | `launch.read_state_us`, `launch.fonts_us`, `launch.config_us`, `launch.toolkit_us`, `launch.frames_before_interactive`, `launch.files_opened` | Time inside reading saved state, setting up fonts, loading config and plugins, starting the webview or toolkit; frames presented and files opened before `launch.interactive_us` | `launch.mjs` spans and counts |
| Quit | `quit.gone_us`, `quit.save_state_us` | Close request to the last process of the app gone; time inside saving state | `launch.mjs --quit`, span |
| Typing, 100 scripted keystrokes | `typing.key_to_frame_us_p50`, `typing.key_to_frame_us_p95`, `typing.storage_us`, `typing.state_file_calls_per_100` | Input event received to the frame showing it handed to the compositor; storage time and state-file calls the 100 keystrokes caused | In-app scenario, spans and counts |
| Scrolling a 5,000-line fixture | `scroll.cpu_us`, `scroll.frame_us_p95`, `scroll.frames_dropped` | CPU time the whole scroll cost; frame time, and frames that took over 1.5 refresh intervals, during it | `probe.mjs --scenario`, in-app scenario |
| Idle, 30 s after settle | `idle.private_mb`, `idle.cpu_us`, `idle.threads`, `idle.handles` | Private memory, CPU time burned doing nothing, thread and handle counts | `probe.mjs` |
| Heaviest content | `open_large.ready_us`, `open_large.private_mb_peak`, `reopen.private_mb_growth` | Open command to content shown on the largest fixture; peak memory; memory kept after opening and closing it 20 times | In-app scenario, `probe.mjs` |
| Window work | `resize.frame_us_p95`, `switch.settled_us` | Frame time during a scripted resize; tab or screen switch to its final frame | In-app scenario |
| Size | `binary.bytes`, `installer.bytes` (`stable`) | Built artifacts | Filesystem |

## Web checklist

Answer every row the same way, per key route or flow; loading, interaction and frame metrics take phone and desktop as separate ids.
These are the numbers the gate holds; finding why one is bad is `web-perf`'s audit, whose coverage table lists the techniques to check.

| Area | Metrics | What | Source |
|------|---------|------|--------|
| Loading | `<route>.lcp_us`, `<route>.ttfb_us`, `<route>.cls` (unit `score`) | Core Web Vitals and time to first byte on a cold load | `web-perf` lab trace, median of 3 |
| Interaction | `<flow>.inp_us` | The main interaction to its next paint | Interaction trace |
| Bytes (`stable`) | `<route>.js_kb`, `<route>.css_kb`, `<route>.font_kb`, `<route>.image_kb`, `<route>.requests` | Compressed bytes of the built files the route loads, and its request count | Built output, per the Sizes recipe; network log for the count |
| Main thread | `<route>.long_tasks`, `<route>.blocking_us` | Tasks over 50,000 us during load, and the sum of their time past 50,000 us | Long tasks of the load trace |
| Frames | `<screen>.frame_us_p95`, `<screen>.frames_dropped` | Frame time and frames over 1.5 refresh intervals during a scripted scroll or animation | In-page frame counter |
| Memory | `<flow>.heap_mb`, `<flow>.heap_growth_mb`, `<route>.dom_nodes` | JS heap after the flow; heap kept after repeating it 20 times; DOM size | Heap snapshot, `eval` |
| API | `<endpoint>.latency_us_p50`, `<endpoint>.latency_us_p95`, `<flow>.api_requests` (`stable`) | Latency of each endpoint the flow waits on, under a fixed load; requests the flow issues | Load script, network log |
| Errors (`stable`) | `<flow>.console_errors`, `<flow>.failed_requests` | Console errors and failed requests during the flow; the baseline is 0, so a speedup that breaks a chunk load or an endpoint fails the gate | `console --type error`, network log |

## Android checklist

Answer every row the same way.
Each time below is read from a trace or tool that prints nanoseconds or milliseconds: convert to integer microseconds and give the metric the resolution its row states.
iOS has no checklist here.

| Area | Metrics | From, to | Source, resolution |
|------|---------|----------|--------------------|
| Launch, per start kind | `launch.cold_ttid_us`, `launch.cold_ttfd_us`, `launch.warm_ttid_us`, `launch.hot_ttid_us` | The system receiving the launch intent to: the first frame of the destination Activity rendered (TTID), the first frame rendered after or containing the `reportFullyDrawn()` call (TTFD; an app that never calls it has no TTFD) | Macrobenchmark `StartupTimingMetric` (`timeToInitialDisplayMs`, `timeToFullDisplayMs`) under `StartupMode.COLD`, `WARM`, `HOT`; trace-derived, below 1 us |
| Launch, where it goes | `launch.<section>_us`, `launch.<reason>_us` | `Trace.beginSection(name)` to its `endSection()` on the same thread; each exclusive interval of the startup grouped by its `reason` | `dur` of the `slice` table and of `android_startup_opinionated_breakdown`, in ns, queried with `trace_processor` from the iteration's `.perfetto-trace`; `resolution: 10` for a section, the cost of one marker pair |
| Quit | Not applicable | Android documents no quit or background latency | |
| Typing or tapping, 100 scripted events | `typing.input_to_frame_us_p50`, `typing.input_to_frame_us_p95`, `typing.handling_us_p95` | The input event read by InputReader to the present time of the frame it caused; the event received by the app to its ACK sent | `end_to_end_latency_dur` and `handling_latency_dur` of `android_input_events`, in ns; the first lands on a refresh, so `resolution` is the refresh interval (16,667 at 60 Hz, 8,333 at 120 Hz) |
| Scrolling a fixed list | `scroll.frame_overrun_us_p95`, `scroll.frame_cpu_us_p95`, `scroll.frames_janky`, `scroll.frames` | The frame's deadline to its completion (positive is a missed deadline); the time producing the frame on the UI thread and RenderThread; frames with a positive overrun; frames produced | `overrun` and `cpu_time` of `android_frame_stats`, in ns, from the trace Macrobenchmark's `FrameTimingMetric` run leaves; needs Android 12; below 1 us |
| Idle, 30 s after settle | `idle.pss_kb`, `idle.private_dirty_kb`, `idle.cpu_us` | Snapshot of the `TOTAL` row; `utime` plus `stime` burned over the 30 s | `adb shell dumpsys meminfo <package>` (`Pss Total`, `Private Dirty`, in KB); fields 14 and 15 of `/proc/<pid>/stat`, in clock ticks, so `resolution` is one tick in us |
| Heaviest content | `open_large.rss_anon_kb_peak`, `reopen.activities` | Largest sample while the largest fixture opens; `Activities` count after opening and closing it 20 times, where growth is a leaked Activity | `MemoryUsageMetric(mode = Max)` (`memoryRssAnonKb`); `dumpsys meminfo` object counts |
| Size (`stable`) | `apk.bytes`, `apk.download_bytes`, `apk.method_refs` | Built release APK | `apkanalyzer apk file-size`, `apk download-size` (an estimate), `dex references` |
| Energy, Pixel 6 or newer only | `scroll.energy_total_uws` | System-wide energy over the measured block, not the app's share | Macrobenchmark `PowerMetric` (`energyTotalUws`) |

- **A physical device, or no baseline:** Macrobenchmark refuses an emulator and a low battery, and the app under test is `profileable` and not debuggable.
  With no device attached, Setup step 5 applies, and the benchmark module is written with the measurement scripts.
- **The device is part of the id:** `ratchet.mjs` buckets by the host machine, so prefix each device-bound id with the device model (`pixel8.launch.cold_ttid_us`).
- **Pin the compilation mode:** pass `CompilationMode` explicitly (`Partial(baselineProfileMode = BaselineProfileMode.Require)` for what users get), since it moves every time metric.
- **Feed the gate by hand:** one `./gradlew :macrobenchmark:connectedCheck` yields every iteration of every metric in the `benchmarkData.json` under `build/outputs/connected_android_test_additional_output/`; a script under `.perf/measure/` reads `benchmarks[].metrics.<name>.runs[]`, multiplies milliseconds by 1,000 and calls `ratchet.mjs record <id> <values>`.
- **Keep `dumpsys meminfo` out of a frame measurement:** it forces a garbage collection in the app.
- **A table with no rows fails the script:** `android_input_events` and `android_frame_stats` are empty when the trace lacked their data source, and a missing value must not read as zero.

## Recipes

### Clocks

Read time from the language's monotonic clock and convert to integer microseconds:

| Runtime | Clock | Resolution |
|---------|-------|------------|
| Rust | `std::time::Instant` | below 1 us |
| C, C++ | `std::chrono::steady_clock`, `QueryPerformanceCounter`, `clock_gettime(CLOCK_MONOTONIC)` | below 1 us |
| Node, Electron main | `process.hrtime.bigint()` | below 1 us |
| Go, .NET, Python | `time.Since`, `Stopwatch`, `time.perf_counter_ns()` | below 1 us |
| Webview or browser JS | `performance.now()` | 100 us, or 5 us on a cross-origin isolated page (MDN, "High precision timing") |

Give a metric timed in webview JS `resolution: 100`, or take the timestamp on the native side.
A timer around a function call measures the function; a metric the user feels starts at the input or the launch and ends at the frame.

### Launch, quit and in-app scenarios

`launch.mjs` starts the app with `PERF_MARKS=1` and reads what it reports, one flushed line per event on stdout or stderr:

```
@perf mark window 41873          a moment, in us since the first statement of the entry point
@perf span read_state 9120       a duration in us
@perf count state_file_calls 39  work done
@perf done                       the measured run is over
```

```
node .perf/bin/launch.mjs --quit -- dist/app.exe
{"pre_main_us":18240,"window_us":60113,"first_frame_us":71390,"read_state_us":9120,"state_file_calls":39,"quit_us":84512}
```

- Every mark comes out as `<name>_us` counted from process creation, with `pre_main_us` the part before the app's first statement (loader, dynamic libraries, static initializers); spans and counts pass through unchanged.
- The app prints only when `PERF_MARKS` is set, so a normal run pays nothing.
  Webview code sends its marks to the native side, which prints them.
- `launch.mjs` fails when no `@perf done` arrives or when marks arrive batched from a buffer; fix the app's output, since a buffered mark carries a false time.
- The marks read high by the time a line takes to cross the pipe, about the same on every run, so it cancels when two runs are compared.
  Its spread does not: run `node .perf/bin/launch.mjs --calibrate` on the machine and set `pipe_jitter_us` as `resolution` on every mark metric.
  Spans and counts need none.
- A mark says what the app observed, so `first_frame_us` is the frame handed to the compositor: native code marks it when the present or swap call returns, a webview in the second `requestAnimationFrame` after the render.
  The frame reaches the glass up to one refresh later (16,667 us at 60 Hz); on Windows, PresentMon reports that displayed time per frame, and a metric built on it carries the refresh interval as `resolution`.
- `--quit` asks the app to close the way a user does (its windows' close message on Windows, SIGTERM on Linux) and times until every process of its tree is gone.
  On Linux, child processes that outlive the main one are polled, so give `quit.gone_us` `resolution: 1000` there.
- A scenario beyond launch runs inside the app: an environment variable selects it (`PERF_SCENARIO=typing`), the app feeds synthetic input into the top of its own input path after launch, and prints its spans, counts and percentiles before `@perf done`.
  Events injected from outside (SendKeys, xdotool) arrive with the driver's own jitter, so they suit counts and CPU time but not per-event latency.
  Input injected in webview JS skips the OS and webview input path; say so in the report.
- Count work at the one function every call passes through (the storage wrapper, the file-open helper), and reset the counters when the scenario starts.
  The scenario waits for pending work (a debounced save, a queued write) to drain before `@perf done`.
  A count that depends on pace, such as saves behind a time debounce, is `stable` only when the scenario also drives the clock; otherwise leave `stable` off.

Launch has its own definitions, cold-start protocol and techniques: [launch.md](launch.md).

### RAM and CPU of an app

`probe.mjs` launches the command, waits `--settle` seconds, samples the process tree every `--interval` seconds for `--duration`, kills the tree, and prints `rss_mb_peak`, `rss_mb_mean`, `private_mb_peak`, `private_mb_mean`, `cpu_pct_mean`, `cpu_pct_peak`, `cpu_us`, `cpu_resolution_us`, `threads_peak`, `handles_peak`, `window_us` and `samples`.
Point several metrics at the same command with different `pick` keys; `measure` runs a shared command once per run.

```
node .perf/bin/probe.mjs --settle 5 --duration 30 -- dist/app.exe
node .perf/bin/probe.mjs --settle 5 --scenario "node .perf/measure/scroll.mjs" -- dist/app.exe
node .perf/bin/probe.mjs --pid 1234 --duration 10
```

- `--scenario` samples from the driver command's start to its exit, so `cpu_us` is what the scroll or the typing cost and `scenario_us` how long it ran.
- `cpu_us` comes from the kernel's CPU-time counters, which advance in steps of `cpu_resolution_us` (15,625 on Windows, usually 10,000 on Linux) per running thread: set that as the metric's `resolution`, and make the scenario long enough to cost many steps.
- Prefer `private_mb` to `rss_mb`: RSS and working set count pages shared between processes once per process, and Windows trims a working set at will.
- A memory peak shorter than `--interval` falls between samples; lower the interval, not below 0.5 on Windows, where each sample is a CIM query.
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

### FPS and frame time

- **Web:** run a `requestAnimationFrame` counter in the page during the scripted scroll or animation (`chrome-devtools-axi eval`), print the frame deltas, and report `fps_p5` and `frame_us_p95`; or read frames from a `perf-start --no-reload` trace.
- **Desktop or game:** an in-app frame counter that reports the percentiles as `@perf span` lines after a fixed scripted sequence is the most repeatable source.
  On Windows, PresentMon captures present intervals from outside the app.
- Fix the window size and the content shown; FPS depends on both.
- An interval between `requestAnimationFrame` callbacks or presents is a multiple of the refresh interval, so a metric built on it takes that interval as `resolution` (16,667 us at 60 Hz).
  The time to produce a frame (frame start to submitted, timed in the app) resolves finer and shows a gain before it crosses a refresh boundary: gate both.

### Web Vitals

Run the `web-perf` lab trace (phase 3) three times per route and profile, then `record` each value in microseconds: `ratchet.mjs record home.lcp_us 1840000 1910000 1795000`.
A script that drives `chrome-devtools-axi` and prints `{"lcp_us":..,"cls":..}` turns this into a `command` with `pick`.
Field data (CrUX, RUM) is never a ratchet sample: it lags by weeks and mixes many releases.

### Web memory, API and errors

- **Heap:** `chrome-devtools-axi heap <path>` writes a heap snapshot; sum `self_size` over its nodes for the live JS heap.
  `performance.memory` is non-standard and coarsened, so it is never a sample.
- **Leak:** snapshot after the flow, repeat the flow 20 times, snapshot again; the difference is `heap_growth_mb`, and a heap that only grows names the leak.
- **API latency:** time each endpoint with a load script against a fixed seed and report p50 and p95; one request in a network log is one sample, not a latency.
- **Requests and errors:** count the flow's `fetch` and `xhr` entries, its responses with status 400 and above, and its `console --type error` messages.
  The same flow issues the same requests, so these are `stable` when the backend is seeded.

### Database at scale

A scale sweep shows which queries break as data grows, which a fixed fixture cannot.

1. Take the real queries from the code and the real relationships from the schema.
2. Seed one database per scale (`x10`, `x100`, `x1000`, as far as the machine holds), multiplying every relationship from a fixed random seed.
   Keep the production skew, such as a few huge tenants: uniform data hides the plan that fails.
   Run `ANALYZE` after seeding, and reuse the database across runs.
3. One script per scale prints each query's latency as JSON on its last line, read by one metric per query and scale: `{ "id": "sidebar.p95_us.x100", "command": "node .perf/measure/db.mjs x100", "pick": "sidebar_p95_us", "unit": "us", "better": "lower", "warmup": 2 }`.
4. Fix first the query whose time grows faster than its data between two scales: 10x the rows and 30x the time is superlinear.
   `EXPLAIN (ANALYZE, BUFFERS)` on the largest scale shows why.

For `db.queries_per_request`, count the queries one fixed request issues against one fixed seed.
The count takes no timing, so mark it `stable`, and CI catches a new N+1.

### Sizes (`stable`)

Sum the built artifacts after a production build: JS and CSS per route from the bundler's stats file, the installer or binary from the filesystem.
Font bytes per route count the files the loaded page requests (`chrome-devtools-axi network --type font`), since `unicode-range` decides which ones download.
Same input gives the same bytes on every machine, so these gate in CI too.
Check that first: a build that differs between Windows and Linux (line endings, path strings) makes the size machine-bound, so drop `stable` for it.
