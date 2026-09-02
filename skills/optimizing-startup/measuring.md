# Measuring startup in bounces

The benchmark is an external screen recording at 60 fps. Frame math: 1 frame = 16.7 ms, half a bounce = 15 frames, one bounce = 30 frames.

## Two runs per measurement

| Run | Command | Gives |
|---|---|---|
| A, no input | `bounce-record.ps1 -Exe app.exe -Out a.mp4` | settled frame, frame-change count |
| B, keystrokes | `bounce-record.ps1 -Exe app.exe -Out b.mp4 -Keys` | first frame where a typed key is echoed = interactive |

Then `python bounce-frames.py a.mp4` and `python bounce-frames.py b.mp4`. Each prints settled ms and bounces and writes `sheet.png` (frames from launch to settle, cropped to the window, labelled `+ms`) plus `result.json`.

Read `b.mp4`'s sheet with the Read tool and find the first frame showing the typed character. Run B's own "settled" number is meaningless (the keystrokes keep changing frames). Run B requires a control that has focus at launch and echoes text; confirm one exists before recording, and add `autofocus` to the primary input if not.

**Benchmark = max(settled from A, interactive from B).** Report both, in ms and bounces, with the frame-change count from A.

Scripts live in `scripts/` next to this file. `bounce-record.ps1` needs ffmpeg on PATH; `bounce-frames.py` needs numpy and Pillow. Both scripts work on Windows PowerShell 5.1.

## Cold means cold

The first launch after boot is the benchmark. Approximations, from best to worst:

1. Reboot, wait for the desktop to go idle (Task Manager disk at 0 %), record.
2. Sysinternals RAMMap, Empty > Empty Standby List, then record. Drops file cache without a reboot.
3. Nothing: a warm number. Label it warm; it is not the benchmark.

WebView2 apps: if Microsoft Edge or another WebView2 app is running, the runtime is already in memory and the launch is warm. Close them for a cold run and say which state you measured. Windows Defender scans a freshly built exe on its first run; the first launch after a build is slower than the first launch after a boot. Launch once after building, then do the cold protocol.

While iterating, use the standby-list flush between runs. For the final sheet, reboot. Take three cold runs and report the median.

## The floor

Record a hello-world on the same stack with the same protocol: `pnpm create tauri-app` default, `electron-quick-start`, or a `main` that only creates a window. Its settled ms is what the platform costs on this machine. The app's number minus the floor is the part you can remove. Report both.

## Attribution marks

After the recording says how slow, marks say where. They are never the benchmark.

- Rust/native: `std::time::Instant` at process entry, after window creation, after first page load. Append `name,elapsed_ms` to a temp file; release builds have no console.
- Web/JS: `performance.timeOrigin`, `PerformanceObserver` on `paint` entries (`first-contentful-paint`), and a double `requestAnimationFrame` after the last data render for "settled". `console.log` is invisible in a release build: send marks over IPC to the native sink (a `#[tauri::command]`, or `ipcRenderer` in Electron) that writes the same temp file.
- Whole process on Windows: `wpr -start GeneralProfile`, launch, `wpr -stop trace.etl`, open in Windows Performance Analyzer. WebView2: record with Microsoft's `WebView2.wprp` profile.
- Linux: `perf trace -s`, `strace -r -f -e trace=openat,execve,mmap`, `LD_DEBUG=statistics` for dynamic-loader cost.

## Linux recording (not exercised on this machine)

Same idea, different tools:

- X11: `ffmpeg -f x11grab -framerate 60 -draw_mouse 0 -i :0 -t 4 rec.mp4`. Wayland: `wf-recorder -f rec.mp4` (wlroots) or the compositor's own recorder at 60 fps.
- Marker: show a 60×60 magenta topmost window at the launch instant (a one-line `tkinter` or `zenity --info` window positioned at 0,0), then `exec` the app. `bounce-frames.py` finds it the same way.
- Keystrokes: `xdotool type --delay 100 qqqq` (X11) or `ydotool type` (Wayland) once the window exists.
