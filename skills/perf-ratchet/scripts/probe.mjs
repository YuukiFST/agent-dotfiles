#!/usr/bin/env node
// Sample memory and CPU of a process tree (the root plus every descendant, so
// Electron and browser helpers count) and print one JSON line for ratchet.mjs:
//   {"rss_mb_peak":..,"rss_mb_mean":..,"cpu_pct_mean":..,"samples":..}
// cpu_pct is one core = 100, so a busy 4-core app can read 400.
//
//   node probe.mjs [--settle 5] [--duration 10] [--interval 1] -- <app command>
//   node probe.mjs --pid <pid> [--duration 10] [--interval 1]
//
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
  const opts = { settle: 5, duration: 10, interval: 1, pid: null, command: null };
  const dash = argv.indexOf("--");
  const flags = dash === -1 ? argv : argv.slice(0, dash);
  if (dash !== -1) opts.command = argv.slice(dash + 1).join(" ");
  for (let i = 0; i < flags.length; i += 2) {
    const key = flags[i].replace(/^--/, "");
    const value = Number(flags[i + 1]);
    if (!(key in opts) || key === "command" || !Number.isFinite(value) || value < 0) die(`bad flag ${flags[i]} ${flags[i + 1] ?? ""}`);
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
function linuxSampler() {
  const pageBytes = getconf("PAGESIZE", 4096);
  const ticksPerSec = getconf("CLK_TCK", 100);
  return async function sample(rootPid) {
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
      procs.push({ pid: Number(entry), ppid: Number(f[1]), cpuSec: (Number(f[11]) + Number(f[12])) / ticksPerSec, rssBytes: Number(f[21]) * pageBytes });
    }
    return descendants(rootPid, procs);
  };
}

// Windows: one long-lived PowerShell answers each sample request on stdin, since a
// fresh PowerShell per sample costs about a second of startup.
function windowsSampler() {
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
while ($null -ne ($line = [Console]::In.ReadLine())) {
  Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize,KernelModeTime,UserModeTime |
    ForEach-Object { '{0} {1} {2} {3}' -f $_.ProcessId, $_.ParentProcessId, $_.WorkingSetSize, ($_.KernelModeTime + $_.UserModeTime) }
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
      const [pid, ppid, ws, cpu100ns] = line.trim().split(" ").map(Number);
      return { pid, ppid, rssBytes: ws, cpuSec: cpu100ns / 1e7 };
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
  try {
    for (let i = 0; i < count; i++) {
      // A CIM query takes a few hundred ms; the midpoint is the best estimate of
      // when its CPU counters were read.
      const asked = performance.now();
      const tree = await sample(rootPid);
      const answered = performance.now();
      if (tree.length === 0) throw new Error(`process ${rootPid} is not running${i === 0 ? "" : " any more"}`);
      points.push({
        t: (asked + answered) / 2000,
        rssBytes: tree.reduce((sum, p) => sum + p.rssBytes, 0),
        cpuSec: tree.reduce((sum, p) => sum + p.cpuSec, 0),
      });
      if (i < count - 1) await sleep(opts.interval * 1000);
    }
  } finally {
    sample.close?.();
    if (child) killTree(child);
  }

  // A helper process exiting between samples drops its CPU time from the sum, so a
  // negative interval reads as idle rather than as negative load.
  const cpuPct = points.slice(1).map((p, i) => Math.max(0, (p.cpuSec - points[i].cpuSec) / (p.t - points[i].t)) * 100);
  const mb = (bytes) => Number((bytes / 2 ** 20).toFixed(1));
  const result = {
    rss_mb_peak: mb(Math.max(...points.map((p) => p.rssBytes))),
    rss_mb_mean: mb(points.reduce((sum, p) => sum + p.rssBytes, 0) / points.length),
    cpu_pct_mean: Number((cpuPct.reduce((a, b) => a + b, 0) / cpuPct.length).toFixed(1)),
    samples: points.length,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((err) => die(err.message));
