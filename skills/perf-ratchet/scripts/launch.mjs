#!/usr/bin/env node
// Time an app's launch and quit in microseconds and print one JSON line for
// ratchet.mjs. The app is started with PERF_MARKS=1 and reports on stdout or
// stderr, one flushed line per event, from a monotonic clock whose zero is the
// first statement of its entry point:
//
//   @perf mark <name> <us>    a moment: microseconds since the app's clock zero
//   @perf span <name> <us>    a duration, e.g. the time spent reading saved state
//   @perf count <name> <n>    work done, e.g. files opened
//   @perf done                launch is over (settled and accepting input)
//
//   node launch.mjs [--timeout 30] [--hold 0] [--quit] -- <app> [args...]
//   node launch.mjs --calibrate
//
// Output: "pre_main_us" (process creation up to the app's clock zero), every mark
// as "<name>_us" counted from process creation, every span as "<name>_us", every
// count as "<name>", and with --quit "quit_us": from the close request until the
// last process of the app's tree is gone.
//
// The app's clock is placed on this script's clock by the fastest mark to cross
// the pipe, so pre_main_us and the marks read high by that pipe latency. It is
// nearly the same on every run, so it cancels between two runs; what does not
// cancel is its run-to-run spread, which --calibrate measures on this machine
// (pipe_jitter_us). Spans and counts cross no clock and are exact. --hold waits
// that many seconds after "done".
// The app runs without a shell; Windows and Linux only for --quit.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";

const nowUs = () => Number(process.hrtime.bigint() / 1000n);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Two marks more than this apart in the app that arrive in one read were held
// in a buffer, so their arrival time says nothing about when they happened.
const BATCH_GAP_US = 1000;
const EVENT_LINE = /^@perf (mark|span|count) ([a-z0-9_]+) (\d+)$/;

function die(message) {
  process.stderr.write(`launch: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { timeout: 30, hold: 0, quit: false, calibrate: false, command: null };
  const dash = argv.indexOf("--");
  const flags = dash === -1 ? argv : argv.slice(0, dash);
  if (dash !== -1) opts.command = argv.slice(dash + 1);
  for (let i = 0; i < flags.length; i++) {
    const key = flags[i].replace(/^--/, "");
    if (key === "quit" || key === "calibrate") {
      opts[key] = true;
      continue;
    }
    const value = Number(flags[++i]);
    if ((key !== "timeout" && key !== "hold") || !Number.isFinite(value) || value < 0) die(`bad flag ${flags[i - 1]} ${flags[i] ?? ""}`);
    opts[key] = value;
  }
  if (opts.calibrate === Boolean(opts.command?.length)) die("give either --calibrate or -- <app> [args...]");
  return opts;
}

function killTree(child) {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

// Start the app and collect its @perf lines until "done". Each mark keeps the
// instant its line arrived here, which anchors the app's clock to this one.
function runApp(command, timeoutSec) {
  return new Promise((resolve, reject) => {
    const events = { marks: [], spans: {}, counts: {} };
    const spawnedAt = nowUs();
    const child = spawn(command[0], command.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PERF_MARKS: "1" },
      detached: process.platform !== "win32",
    });
    const giveUp = (message) => {
      clearTimeout(timer);
      killTree(child);
      reject(new Error(message));
    };
    const seen = () => [...events.marks.map((m) => m.name), ...Object.keys(events.spans), ...Object.keys(events.counts)].join(", ") || "none";
    const timer = setTimeout(
      () => giveUp(`no "@perf done" within ${timeoutSec} s (events received: ${seen()}); the app prints its @perf lines to stdout when PERF_MARKS=1 and flushes after each one`),
      timeoutSec * 1000,
    );
    child.on("error", (err) => giveUp(`"${command[0]}" did not start: ${err.message}`));
    child.on("exit", (code) => giveUp(`the app exited (${code}) before "@perf done" (events received: ${seen()})`));

    let done = false;
    const onChunk = (pending) => (chunk) => {
      const arrivedAt = nowUs();
      if (done) return; // keep draining so the app never blocks on a full pipe
      pending.text += chunk;
      const lines = pending.text.split(/\r?\n/);
      pending.text = lines.pop();
      const batch = [];
      const buffered = () => {
        const gap = Math.max(...batch) - Math.min(...batch);
        if (gap > BATCH_GAP_US) giveUp(`marks ${gap} us apart arrived in one read, so the app buffers its output; flush after every @perf line`);
        return gap > BATCH_GAP_US;
      };
      for (const line of lines) {
        if (line === "@perf done") {
          if (buffered()) return;
          done = true;
          clearTimeout(timer);
          child.removeAllListeners("exit");
          return resolve({ child, spawnedAt, events });
        }
        const event = EVENT_LINE.exec(line);
        if (!event) {
          if (line.startsWith("@perf")) return giveUp(`malformed line "${line}"; expected "@perf mark|span|count <name> <integer>" or "@perf done"`);
          continue;
        }
        const [, kind, name, digits] = event;
        const value = Number(digits);
        const taken = kind === "mark" ? events.marks.some((m) => m.name === name) : name in events.spans || name in events.counts;
        if (taken) return giveUp(`"${name}" was reported twice`);
        if (kind === "span") events.spans[name] = value;
        else if (kind === "count") events.counts[name] = value;
        else {
          events.marks.push({ name, us: value, arrivedAt });
          batch.push(value);
        }
      }
      buffered();
    };
    child.stdout.setEncoding("utf8").on("data", onChunk({ text: "" }));
    child.stderr.setEncoding("utf8").on("data", onChunk({ text: "" }));
  });
}

function linuxTree(rootPid) {
  const parentOf = new Map();
  for (const entry of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
      parentOf.set(Number(entry), Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]));
    } catch {
      // exited between readdir and read
    }
  }
  const tree = [rootPid];
  for (const pid of tree) for (const [child, parent] of parentOf) if (parent === pid) tree.push(child);
  return tree;
}

// SIGTERM to the app, then the instant the last process of its tree is gone. The
// root's exit arrives as an event; descendants that outlive it are polled every
// millisecond, which is then the resolution of quit_us.
async function quitLinux(child, timeoutSec) {
  const tree = linuxTree(child.pid);
  const rootGone = new Promise((resolve) => child.once("exit", () => resolve(nowUs())));
  const askedAt = nowUs();
  child.kill("SIGTERM");
  const deadline = askedAt + timeoutSec * 1e6;
  let goneAt = await Promise.race([rootGone, sleep(timeoutSec * 1000)]);
  const alive = (pid) => fs.existsSync(`/proc/${pid}`);
  while (goneAt !== undefined && tree.some(alive)) {
    if (nowUs() > deadline) goneAt = undefined;
    else {
      await sleep(1);
      goneAt = nowUs();
    }
  }
  if (goneAt === undefined) throw new Error(`the app was still running ${timeoutSec} s after SIGTERM`);
  return goneAt - askedAt;
}

// One PowerShell holds a handle to every process of the tree, posts WM_CLOSE to
// each top-level window and waits on the handles, so both ends of quit_us come
// from one Stopwatch and no polling interval sits between them.
function quitWindows(child, timeoutSec) {
  const script = `
$ErrorActionPreference = 'Stop'
$all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId
$ids = New-Object System.Collections.Generic.List[int]
$ids.Add(${child.pid})
for ($i = 0; $i -lt $ids.Count; $i++) {
  foreach ($p in $all) { if ($p.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$p.ProcessId)) { $ids.Add([int]$p.ProcessId) } }
}
$procs = @()
foreach ($id in $ids) { try { $p = [Diagnostics.Process]::GetProcessById($id); $null = $p.Handle; $procs += $p } catch {} }
$windows = @($procs | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
if ($windows.Count -eq 0) { 'NOWINDOW'; exit }
$clock = [Diagnostics.Stopwatch]::StartNew()
foreach ($w in $windows) { $null = $w.CloseMainWindow() }
foreach ($p in $procs) {
  $left = [int](${timeoutSec * 1000} - $clock.ElapsedMilliseconds)
  if ($left -lt 0 -or -not $p.WaitForExit($left)) { 'TIMEOUT'; exit }
}
'QUIT {0}' -f [long]($clock.ElapsedTicks * 1000000 / [Diagnostics.Stopwatch]::Frequency)`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const res = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { encoding: "utf8" });
  const answer = res.stdout.trim().split(/\r?\n/).pop() ?? "";
  if (answer === "NOWINDOW") throw new Error("no process of the app owns a top-level window, so there is nothing to close");
  if (answer === "TIMEOUT") throw new Error(`the app was still running ${timeoutSec} s after its windows were asked to close`);
  if (!answer.startsWith("QUIT ")) throw new Error(`the quit timer failed: ${res.stderr.trim() || answer}`);
  return Number(answer.slice(5));
}

async function measureLaunch(opts) {
  const { child, spawnedAt, events } = await runApp(opts.command, opts.timeout);
  const result = {};
  try {
    if (events.marks.length === 0) throw new Error('"@perf done" came with no "@perf mark" before it, so the app\'s clock cannot be placed');
    // The mark that crossed the pipe fastest bounds the app's clock zero best.
    const clockZeroAt = Math.min(...events.marks.map((m) => m.arrivedAt - m.us));
    result.pre_main_us = clockZeroAt - spawnedAt;
    for (const mark of events.marks) result[`${mark.name}_us`] = result.pre_main_us + mark.us;
    for (const [name, us] of Object.entries(events.spans)) {
      if (`${name}_us` in result) throw new Error(`"${name}" is both a mark and a span`);
      result[`${name}_us`] = us;
    }
    for (const [name, n] of Object.entries(events.counts)) {
      if (name in result) throw new Error(`count "${name}" collides with another key`);
      result[name] = n;
    }
    await sleep(opts.hold * 1000);
    if (opts.quit) {
      if (process.platform !== "win32" && process.platform !== "linux") throw new Error(`--quit is not supported on ${process.platform}`);
      result.quit_us = process.platform === "win32" ? quitWindows(child, opts.timeout) : await quitLinux(child, opts.timeout);
    }
  } finally {
    killTree(child);
  }
  return result;
}

// A child that stamps each line with the system-wide monotonic clock this script
// also reads, so the gap on arrival is the pipe latency of this machine.
async function calibrate() {
  const stamper = 'for (let i = 0; i < 50; i++) { process.stdout.write(process.hrtime.bigint() / 1000n + "\\n"); const until = process.hrtime.bigint() + 5000000n; while (process.hrtime.bigint() < until); }';
  const child = spawn(process.execPath, ["-e", stamper], { stdio: ["ignore", "pipe", "inherit"] });
  const latencies = [];
  let text = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => {
    const arrivedAt = nowUs();
    text += chunk;
    const lines = text.split("\n");
    text = lines.pop();
    for (const line of lines) latencies.push(arrivedAt - Number(line));
  });
  await new Promise((resolve) => child.on("close", resolve));
  latencies.sort((a, b) => a - b);
  const median = latencies[latencies.length >> 1];
  return { pipe_latency_us_min: latencies[0], pipe_latency_us_median: median, pipe_jitter_us: median - latencies[0], samples: latencies.length };
}

const opts = parseArgs(process.argv.slice(2));
(opts.calibrate ? calibrate() : measureLaunch(opts)).then(
  (result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(0);
  },
  (err) => die(err.message),
);
