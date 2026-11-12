#!/usr/bin/env node
// Sample memory and CPU of a process tree (the root plus every descendant, so
// Electron and browser helpers count) and print one JSON line for ratchet.mjs:
//   {"rss_mb_peak":..,"rss_mb_mean":..,"private_mb_peak":..,"private_mb_mean":..,
//    "cpu_pct_mean":..,"cpu_pct_peak":..,"cpu_us":..,"cpu_resolution_us":..,
//    "threads_peak":..,"handles_peak":..,"window_us":..,"samples":..}
// cpu_pct is one core = 100, so a busy 4-core app can read 400. cpu_us is the CPU
// time the tree consumed inside the sampled window, read from the kernel's own
// counters, which advance in steps of cpu_resolution_us per running thread.
// private_mb is memory no other process shares; it is left out when the OS
// refuses to report it for any process of the tree.
//
//   node probe.mjs [--settle 5] [--duration 10] [--interval 1] -- <app command>
//   node probe.mjs --pid <pid> [--duration 10] [--interval 1]
//   node probe.mjs [--settle 5] --scenario "<driver command>" -- <app command>
//
// --scenario runs a command that drives the app (scroll, type) and samples from
// its start to its exit instead of for --duration; scenario_us is its wall time.
// A launched app is killed with its tree after sampling; an attached --pid is left
// running. Windows and Linux only (/proc and Win32_Process).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function die(message) {
  process.stderr.write(`probe: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { settle: 5, duration: 10, interval: 1, pid: null, command: null, scenario: null };
  const dash = argv.indexOf("--");
  const flags = dash === -1 ? argv : argv.slice(0, dash);
  if (dash !== -1) opts.command = argv.slice(dash + 1).join(" ");
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].replace(/^--/, "");
    if (key === "scenario" && flags[i + 1]) {
      opts.scenario = flags[i + 1];
      continue;
    }
    const value = Number(flags[i + 1]);
    if (!(key in opts) || key === "command" || key === "scenario" || !Number.isFinite(value) || value < 0) die(`bad flag ${flags[i]} ${flags[i + 1] ?? ""}`);
    opts[key] = value;
  }
  if ((opts.pid === null) === !opts.command) die("give either --pid <pid> or -- <app command>");
  if (opts.interval <= 0) die("--interval must be > 0");
  return opts;
}

function descendants(rootPid, procs) {
  const children = new Map();
  for (const p of procs) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p);
  }
  const tree = procs.filter((p) => p.pid === rootPid);
  for (let i = 0; i < tree.length; i++) tree.push(...(children.get(tree[i].pid) ?? []));
  return tree;
}

function getconf(name, fallback) {
  const res = spawnSync("getconf", [name], { encoding: "utf8" });
  const value = Number(res.stdout?.trim());
  return res.status === 0 && value > 0 ? value : fallback;
}

// Linux: /proc/<pid>/stat; comm may hold spaces and parens, so split after the last ")".
function linuxPrivateBytes(pid) {
  try {
    const rollup = fs.readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
    let kb = 0;
    for (const line of rollup.matchAll(/^Private_(?:Clean|Dirty):\s+(\d+) kB$/gm)) kb += Number(line[1]);
    return kb * 1024;
  } catch {
    return null; // another user's process, or it exited
  }
}

function linuxOpenFiles(pid) {
  try {
    return fs.readdirSync(`/proc/${pid}/fd`).length;
  } catch {
    return 0;
  }
}

function linuxSampler() {
  const pageBytes = getconf("PAGESIZE", 4096);
  const ticksPerSec = getconf("CLK_TCK", 100);
  const sample = async function sample(rootPid) {
    const procs = [];
    for (const entry of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      let stat;
      try {
        stat = fs.readFileSync(`/proc/${entry}/stat`, "utf8");
      } catch {
        continue; // exited between readdir and read
      }
      const f = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      procs.push({ pid: Number(entry), ppid: Number(f[1]), cpuSec: (Number(f[11]) + Number(f[12])) / ticksPerSec, rssBytes: Number(f[21]) * pageBytes, threads: Number(f[17]) });
    }
    return descendants(rootPid, procs).map((p) => ({ ...p, privateBytes: linuxPrivateBytes(p.pid), handles: linuxOpenFiles(p.pid) }));
  };
  sample.cpuResolutionUs = Math.round(1e6 / ticksPerSec);
  return sample;
}

// Windows: one long-lived PowerShell answers each sample request on stdin, since a
// fresh PowerShell per sample costs about a second of startup.
function windowsSampler() {
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
while ($null -ne ($line = [Console]::In.ReadLine())) {
  Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime,PrivatePageCount,ThreadCount,HandleCount |
    ForEach-Object { '{0} {1} {2} {3} {4} {5} {6}' -f $_.ProcessId, $_.ParentProcessId, $_.WorkingSetSize, ($_.KernelModeTime + $_.UserModeTime), $_.PrivatePageCount, $_.ThreadCount, $_.HandleCount }
  'END'
}`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const ps = spawn("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { stdio: ["pipe", "pipe", "inherit"] });
  let buffer = "";
  let pending = null;
  ps.stdout.setEncoding("utf8");
  ps.stdout.on("data", (chunk) => {
    buffer += chunk;
    const end = buffer.indexOf("END");
    if (end === -1 || !pending) return;
    const body = buffer.slice(0, end);
    buffer = buffer.slice(end + 3);
    const procs = body.trim().split(/\r?\n/).filter(Boolean).map((line) => {
      const [pid, ppid, ws, cpu100ns, privateBytes, threads, handles] = line.trim().split(" ").map(Number);
      return { pid, ppid, rssBytes: ws, cpuSec: cpu100ns / 1e7, privateBytes, threads, handles };
    });
    const resolve = pending;
    pending = null;
    resolve(procs);
  });
  const sample = (rootPid) =>
    new Promise((resolve) => {
      pending = (procs) => resolve(descendants(rootPid, procs));
      ps.stdin.write("\n");
    });
  sample.close = () => ps.stdin.end();
  // Windows charges CPU time to a thread once per clock interrupt, 15.625 ms apart.
  sample.cpuResolutionUs = 15625;
  return sample;
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (os.platform() !== "linux" && os.platform() !== "win32") die(`unsupported platform ${os.platform()}`);
  const sample = os.platform() === "win32" ? windowsSampler() : linuxSampler();

  let child = null;
  let rootPid = opts.pid;
  if (opts.command) {
    child = spawn(opts.command, { shell: true, stdio: "ignore", detached: process.platform !== "win32" });
    rootPid = child.pid;
    child.unref(); // probe exits after sampling even if the kill below misses the app
    await sleep(opts.settle * 1000);
  }

  await sample(rootPid); // the first CIM query loads modules and runs slow; keep it off the clock
  const points = [];
  const count = Math.max(2, Math.round(opts.duration / opts.interval) + 1);
  const total = (tree, field) => tree.reduce((sum, p) => sum + p[field], 0);
  const takePoint = async () => {
    // A CIM query takes a few hundred ms; the midpoint is the best estimate of
    // when its CPU counters were read.
    const asked = performance.now();
    const tree = await sample(rootPid);
    const answered = performance.now();
    if (tree.length === 0) throw new Error(`process ${rootPid} is not running${points.length === 0 ? "" : " any more"}`);
    points.push({
      t: (asked + answered) / 2000,
      rssBytes: total(tree, "rssBytes"),
      cpuSec: total(tree, "cpuSec"),
      privateBytes: tree.some((p) => p.privateBytes === null) ? null : total(tree, "privateBytes"),
      threads: total(tree, "threads"),
      handles: total(tree, "handles"),
    });
  };
  let scenarioUs = null;
  try {
    if (opts.scenario) {
      await takePoint();
      const started = process.hrtime.bigint();
      const driver = spawn(opts.scenario, { shell: true, stdio: ["ignore", "ignore", "inherit"] });
      const exit = new Promise((resolve, reject) => {
        driver.on("error", reject);
        driver.on("exit", (code) => {
          scenarioUs = Number((process.hrtime.bigint() - started) / 1000n);
          resolve(code);
        });
      });
      let code;
      while ((code = await Promise.race([exit, sleep(opts.interval * 1000)])) === undefined) await takePoint();
      if (code !== 0) throw new Error(`scenario "${opts.scenario}" exited ${code}`);
      await takePoint();
    } else {
      for (let i = 0; i < count; i++) {
        await takePoint();
        if (i < count - 1) await sleep(opts.interval * 1000);
      }
    }
  } finally {
    sample.close?.();
    if (child) killTree(child);
  }

  // A helper process exiting between samples drops its CPU time from the sum, so a
  // negative interval reads as idle rather than as negative load.
  const cpuPct = points.slice(1).map((p, i) => Math.max(0, (p.cpuSec - points[i].cpuSec) / (p.t - points[i].t)) * 100);
  const mb = (bytes) => Number((bytes / 2 ** 20).toFixed(1));
  const peak = (field) => Math.max(...points.map((p) => p[field]));
  const mean = (field) => points.reduce((sum, p) => sum + p[field], 0) / points.length;
  const first = points[0];
  const last = points[points.length - 1];
  const result = {
    rss_mb_peak: mb(peak("rssBytes")),
    rss_mb_mean: mb(mean("rssBytes")),
    ...(points.every((p) => p.privateBytes !== null) && { private_mb_peak: mb(peak("privateBytes")), private_mb_mean: mb(mean("privateBytes")) }),
    cpu_pct_mean: Number((cpuPct.reduce((a, b) => a + b, 0) / cpuPct.length).toFixed(1)),
    cpu_pct_peak: Number(Math.max(...cpuPct).toFixed(1)),
    cpu_us: Math.max(0, Math.round((last.cpuSec - first.cpuSec) * 1e6)),
    cpu_resolution_us: sample.cpuResolutionUs,
    threads_peak: peak("threads"),
    handles_peak: peak("handles"),
    window_us: Math.round((last.t - first.t) * 1e6),
    ...(scenarioUs !== null && { scenario_us: scenarioUs }),
    samples: points.length,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((err) => die(err.message));
