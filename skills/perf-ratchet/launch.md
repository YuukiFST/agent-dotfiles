# Launch

Read when the work is launch or startup time.
Marks, spans and the `launch.mjs` contract are in [metrics.md](metrics.md); this file holds what launch adds.

## What ends a launch

Launch ends at the first frame that is both final and interactive: no further frame changes, input handlers attached, and keyboard focus set.
That moment is `launch.interactive_us`, and the app prints `@perf done` there.
Prove it once per change to the launch path: type the instant the window appears and see the first key land.
Window shown, first frame, skeleton painted and "loading" gone are earlier marks, each its own metric; none of them ends the launch.

Something holds keyboard focus at launch (the primary input, the list), or "interactive" has no definition.

## Cold means cold

The first launch after boot is the one users feel. From truest to weakest:

1. Reboot, wait for the desktop to go idle (Task Manager disk at 0 %), launch.
2. Sysinternals RAMMap, Empty > Empty Standby List, then launch: drops the file cache without a reboot.
3. Neither: a warm launch. Keep it as its own metric id (`launch_warm.*`); it never stands in for cold.

- WebView2 apps: with Microsoft Edge or another WebView2 app running, the runtime is already in memory and the launch is warm. Close them, and say which state you measured.
- Windows Defender scans a freshly built exe on its first run: launch once after building, then start the protocol.
- `ratchet.mjs measure` launches `runs` times in a row, so only the first is cold: put the standby-list flush inside the metric's command for a cold metric, and reboot for the numbers in the final report.
- A resident process with single-instance handoff makes the second launch near-instant and does nothing for the first; report it as a separate metric.

## The floor

Measure a hello-world on the same stack with the same marks: the framework's default template, or a `main` that only creates a window.
Its numbers are what the platform costs on this machine, and the app's minus the floor is the part you own.
Report both before calling a target impossible.

## Attribution outside the app

Spans say where the time goes inside the app. For the part before the first statement (`launch.pre_main_us`) and for the webview:

- Windows: `wpr -start GeneralProfile`, launch, `wpr -stop trace.etl`, open in Windows Performance Analyzer. WebView2: record with Microsoft's `WebView2.wprp` profile.
- Linux: `perf trace -s`, `strace -r -f -e trace=openat,execve,mmap`, `LD_DEBUG=statistics` for dynamic-loader cost.

## Rules a launch is reviewed against

- **The first rendered frame shows the final UI.** Empty window, splash, skeleton, spinner: each is a frame the user watches change, counted by `launch.frames_before_interactive`. Keep the window hidden until the final frame is ready, or make the frame ready earlier.
- **A loading state appears only past a delay** (work already running longer than about 300,000 us). On a normal launch it never appears, and the same timer bounds the hidden window: when it fires, show the window with the indicator.
- **Data arriving after the UI still counts:** it moves `launch.interactive_us`.
- **The main thread does only what the first frame needs.** Everything else runs on another thread or after `@perf done`.

## Techniques, by phase

Fix the phase that owns the most microseconds. One change, `measure`, `check`, keep or revert.
Verify every config key against the framework's schema before writing it.

### Process creation to the entry point (`launch.pre_main_us`)

The OS maps the binary and its dynamic libraries; nothing of yours runs yet.

- Binary size: assets embedded in the exe are paged in with it. Tauri embeds `frontendDist` and, with the default `compression` feature, brotli-compresses each asset and decompresses on every request. Large sprite or dataset payloads belong in `bundle.resources` or a sidecar file. Cheap test first: build once with the asset directories emptied and measure; the delta is what the assets cost.
  Disabling compression means dropping the crate's defaults and re-listing the rest (Tauri 2 defaults: `wry`, `compression`, `common-controls-v6`, `dynamic-acl`, `x11`, `dbus`):

  ```toml
  tauri = { version = "2", default-features = false, features = ["wry", "common-controls-v6", "dynamic-acl", "x11", "dbus"] }
  ```
- Dynamic libraries: fewer and smaller. Each one is a load, relocate and initialize step. Prefer static linking where the platform allows.
- Release profile (Rust): `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`. Smaller and faster to map.
- Static initializers and constructors run before `main`. Keep them trivial.

### Entry point to the window (`launch.window_us`)

- Create the window first. Config parsing, plugin registration, logging, update checks and data loading all come after, or on another thread.
- The window's background color is the app's theme color, set in the window config, so the first composited frame is not white. Tauri: `backgroundColor` (since 2.1.0) and `theme` (Windows and macOS only) on the window entry; confirm both against `node_modules/@tauri-apps/cli/config.schema.json`. Electron: `backgroundColor` in `BrowserWindow` options.
- Hide the window until the final frame: Tauri `"visible": false` in `tauri.conf.json`, then `get_webview_window("main").show()` from a command the frontend calls after its first real render. Electron: `show: false` plus `ready-to-show` or an explicit IPC.

### Window to the first frame (`launch.first_frame_us`, webview apps)

- WebView2 cold spawn is the largest fixed cost on Windows. It cannot be skipped, only overlapped: start it first and do your own work while it comes up. Keep the user data folder on the local disk (default). Do not create a second webview for a splash.
- The initial HTML is static and small. Everything not on the first screen is a separate chunk (route-level code splitting), loaded after `@perf done`.
- Fonts (`launch.fonts_us`): bundled locally, `font-display: block` or preloaded, one family for the first screen. A late font swap is a frame change.
- Providers and context setup that do synchronous work at mount (i18n tables, workspace hydration, storage reads) move off the first render or become lazy.

### First frame to interactive (`launch.content_us`, `launch.interactive_us`)

- The first screen's data is ready before the window is shown. Load it on the native side while the window is created and hand it over in one IPC message, or ship it as an imported module so there is no request at all.
- Saved state (`launch.read_state_us`): read only what the first screen needs, in one read; parse the rest after `@perf done`.
- Render the first screen in one commit: data present, rows present, images with fixed dimensions. Loading, partial, full is three frame changes.
- Virtualized lists render a fixed initial row count; enter animations and transitions are disabled on first mount.
- Layout is stable: reserved space for images, sidebar widths fixed, no measure-then-resize passes.

### After interactive

- Everything else: secondary datasets, update checks, telemetry, plugin init, inactive languages. Trigger from a double `requestAnimationFrame` after the first real render, `requestIdleCallback`, or a native thread.
- Caches that make the next cold launch cheaper (pre-indexed dataset, parsed config) are written here, and read during launch only when the read is cheaper than the compute.
