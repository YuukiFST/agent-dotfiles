---
name: optimizing-startup
description: Use when a desktop app's launch or startup feels slow, when asked to hit a "bounce" or half-bounce startup target, or when a splash, spinner, skeleton, or blank window shows on launch. Windows and Linux desktop apps (Tauri, Electron, native).
---

# Optimizing startup to half a bounce

Unit: one macOS Dock bounce ≈ **500 ms**. Half a bounce = **250 ms**.
Platform floor (loader + toolkit + first window) ≈ 150 ms on fast hardware, so the app's own budget is ~100 ms.
Windows and Linux have no Dock; the unit is the same 500 ms measured from the launch instant.

**The benchmark ends at the first frame that is both fully settled and interactive.**
Settled = no further frame change inside the window. Interactive = first keystroke accepted and echoed.
Window shown, first pixel, skeleton painted, "loading" gone: none of these end the benchmark.

## Loop

1. **Measure cold**, from a screen recording, per [`measuring.md`](measuring.md). Report settled ms, interactive ms, frame-change count, and paste the sheet. `time`, log marks, and warm launches are not the benchmark.
2. **Measure the floor**: record a hello-world window on the same stack (framework template, or the app with UI stubbed). App minus floor = the part you own. Declaring the target impossible needs this number first.
3. **Attribute** the owned part with in-process marks (main, window, first paint, settled). Marks locate ms; they never replace step 1.
4. **Fix the biggest phase** with [`techniques.md`](techniques.md). One change, re-record, keep or revert.
5. **Done** when a cold recording shows settled + interactive ≤ 0.5 bounce with at most 2 frame changes after the window appears, and the sheet is in the report or PR. If the floor recording alone is above 0.5 bounce, done is app − floor ≤ 100 ms with the same frame-change bound, and the report states both numbers.

## Rules startup reviews

- **The first rendered frame shows the final UI.** Empty window, splash, skeleton, spinner: each one is an unsettled frame. Keep the window hidden until the final frame is ready, or make the frame ready earlier. Two frames of waiting beat one frame of flash. The hidden wait is bounded by one bounce; past it, show the window with the delayed loading state.
- **A loading state appears only past a delay threshold** (work already running longer than ~300 ms). On a normal launch it never appears.
- **Something has keyboard focus at launch** (the primary input, the list), so the first keystroke lands without a click. Without it, "interactive" is undefined and run B measures nothing.
- **Count frame changes after the window appears** and drive them to zero. Each layout pass, reconciliation, font swap, or late image is a visible frame change. View-hierarchy reconciliation stays out of the startup path.
- **Post-UI loading still counts.** Data arriving 500 ms after the window is 500 ms on the benchmark.
- **The main thread does only what the first frame needs.** Everything else runs on another thread or after settle.
- **A resident process** (Ghostty on Linux: `+new-window` pokes the running app) speeds follow-on launches only. Report first launch separately.

## Red flags

| Thought | Reality |
|---|---|
| "Skeleton shows fast, so we're done" | Skeleton is an unsettled frame. Benchmark runs until real content. |
| "Warm launch is already fine" | Benchmark is cold. Reboot or flush the standby list. |
| "Marks say 200 ms" | Marks miss compositor, webview and paint. Only the recording counts. |
| "WebView can't do 250 ms" | Record the hello-world floor first. Report the gap, not impossibility. |
| "User wants to keep the spinner" | Keep it behind the delay threshold. A normal launch never shows it. |
| "Static HTML placeholder, React swaps it invisibly" | Placeholder then content is two frames. Show the window once, with content. |
