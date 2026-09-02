# Startup techniques, by phase

Fix the phase that owns the most ms in the attribution marks. One change, re-record, keep or revert. Verify every config key against the framework's schema before writing it.

## 1. Process start → `main`

The OS maps the binary and its dynamic libraries; nothing of yours runs yet.

- Binary size: assets embedded in the exe are paged in with it. Tauri embeds `frontendDist` and, with the default `compression` feature, brotli-compresses each asset and decompresses on every request. Large sprite or dataset payloads belong in `bundle.resources` or a sidecar file, not in the exe. Cheap test first: build once with the asset directories emptied and re-record; the delta is what the assets cost.
  Disabling compression means dropping the crate's defaults and re-listing the rest (Tauri 2 defaults: `wry`, `compression`, `common-controls-v6`, `dynamic-acl`, `x11`, `dbus`):

  ```toml
  tauri = { version = "2", default-features = false, features = ["wry", "common-controls-v6", "dynamic-acl", "x11", "dbus"] }
  ```
- Dynamic libraries: fewer and smaller. Each one is a load, relocate, and initialize step. Prefer static linking where the platform allows.
- Release profile (Rust): `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`. Smaller and faster to map.
- Static initializers and constructors run before `main`. Keep them trivial.

## 2. `main` → window exists

- Create the window first. Config parsing, plugin registration, logging, update checks, and data loading all come after, or on another thread.
- The window's background color is the app's theme color, set in the window config, so the first composited frame is not white. Tauri: `backgroundColor` (since 2.1.0) and `theme` (Windows and macOS only) on the window entry; confirm both against `node_modules/@tauri-apps/cli/config.schema.json`. Electron: `backgroundColor` in `BrowserWindow` options.
- Keep the window hidden until the final frame is ready: Tauri `"visible": false` in `tauri.conf.json`, then `get_webview_window("main").show()` from a command the frontend calls after its first real render. Electron: `show: false` plus `ready-to-show` or an explicit IPC. The visible frame count then starts at 1.

## 3. Window → first paint (webview apps)

- WebView2 cold spawn is the single largest fixed cost on Windows. It cannot be skipped, only overlapped: start it as the very first thing and do your own work while it comes up. Keep the user data folder on the local disk (default). Do not create a second webview for a splash.
- The initial HTML is static and small. A single-page framework must download, parse, and run before it paints anything. Everything not on the first screen is a separate chunk (route-level code splitting), loaded after settle.
- Fonts: bundled locally, `font-display: block` or preloaded, one family for the first screen. A late font swap is a frame change.
- Providers and context setup that do synchronous work at mount (i18n tables, workspace hydration, storage reads) move off the first render or become lazy.

## 4. First paint → settled

- The first screen's data is ready before the window is shown, not fetched after. Load it on the native side during phase 2 and hand it over in one IPC message, or ship it as an imported module so there is no request at all.
- Render the first screen in one commit: data present, rows present, images with fixed dimensions. A sequence of loading → partial → full is three frame changes.
- Virtualized lists render a fixed initial row count; enter animations and transitions are disabled on first mount.
- Layout is stable: reserved space for images, sidebar widths fixed, no measurement-then-resize passes.
- Loading states exist only behind a delay: start the work, arm a timer (~300 ms), show the indicator only if the timer fires first. The same timer bounds the hidden window from phase 2: when it fires, show the window with the indicator instead of staying hidden.

## 5. After settle

- Everything else: secondary datasets, sprite manifests, learnsets, update checks, telemetry, plugin init, non-active languages. Trigger from a double `requestAnimationFrame` after the first real render, or `requestIdleCallback`, or a native thread (`std::thread::spawn`, Tokio task).
- Caches that make the next cold launch cheaper (pre-indexed dataset, parsed config) are written here, never read on the main thread during phases 1–4 unless the read is cheaper than the compute.

## 6. Follow-on launches

A resident process with single-instance handoff (Ghostty on Linux: `+new-window` pokes the running app over IPC) makes the second launch near-instant. It does nothing for the first launch, which is the benchmark. Report it as a separate number.
