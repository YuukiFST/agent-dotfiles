#!/usr/bin/env node
// Opens a throwaway Herdr window on one layout and reports its idle cost and how long the
// window took to appear, so a mod's share can be read apart from the real windows. It joins
// the running core, so it sees the same terminals; closing it ends only that window and its
// `herdr-core connect`. With --working it gets a core of its own holding one agent that reports
// working: animations only cost while an agent works, and a real one may not be.
//   node .perf/measure/isolated.mjs --layout .perf/layouts/board.json [--working] [--rev <git rev>] [--patch <sh run in the copied mods>] [--settle 10] [--seconds 25]
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appHome = path.resolve(here, "..", "..");
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const layoutFile = arg("layout");
const rev = arg("rev");
const settle = Number(arg("settle", 10));
const seconds = Number(arg("seconds", 25));
const patch = arg("patch");
const working = process.argv.includes("--working");
if (!layoutFile) throw new Error("--layout is required");

const temp = path.join(os.tmpdir(), `herdr-perf-${process.pid}`);
const name = path.basename(layoutFile, ".json");
fs.mkdirSync(path.join(temp, "layouts"), { recursive: true });
for (const file of ["settings.json", "keys.json", "installed.json", "seen.json", "update-notes.json"]) {
  if (fs.existsSync(path.join(appHome, file))) fs.copyFileSync(path.join(appHome, file), path.join(temp, file));
}
for (const dir of ["themes", "fonts", "icons", "assets"]) {
  if (fs.existsSync(path.join(appHome, dir))) fs.symlinkSync(path.join(appHome, dir), path.join(temp, dir), "junction");
}
if (rev) {
  execFileSync("sh", ["-c", `git -C "${appHome}" archive ${rev} mods | tar -x -C "${temp}"`]);
} else {
  fs.cpSync(path.join(appHome, "mods"), path.join(temp, "mods"), { recursive: true, filter: (p) => !p.endsWith(".d.ts") });
}
if (patch) execFileSync("sh", ["-c", patch], { cwd: path.join(temp, "mods") });
fs.copyFileSync(layoutFile, path.join(temp, "layouts", `${name}.json`));
const state = JSON.parse(fs.readFileSync(path.join(appHome, "shared.json"), "utf8"));
state.layout = name;
fs.writeFileSync(path.join(temp, "shared.json"), JSON.stringify(state));

const programs = path.join(os.homedir(), "AppData", "Local", "Programs");
const exe = path.join(programs, "herdr-app", "herdr-app.exe");
const hc = path.join(programs, "herdr-core", "hc.exe");
const env = { ...process.env, HERDR_APP_HOME: temp, ...(working ? { HC_SESSION: `perf${process.pid}` } : {}) };
const hcQuiet = (...args) => spawnSync(hc, args, { env, encoding: "utf8" });
if (working) {
  const started = hcQuiet("server", "start");
  if (started.status !== 0) throw new Error(`core did not start: ${started.stderr}`);
  const agent = hcQuiet("run", "--bg", `node ${path.join(here, "fake-agent.mjs").replaceAll("\\", "/")}`);
  if (agent.status !== 0) throw new Error(`agent did not start: ${agent.stderr}`);
}
const powershell = (script, args) => execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, script), ...args], { encoding: "utf8" }).trim().split(/\r?\n/).pop();
const startedAt = Date.now();
const app = spawn(exe, [], { env, stdio: "ignore", detached: true });
app.unref();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const windowMs = Number(powershell("window-wait.ps1", ["-AppId", String(app.pid), "-StartMs", String(startedAt)]));
  await sleep(settle * 1000);
  const stats = JSON.parse(powershell("app-stats.ps1", ["-IdList", String(app.pid), "-Seconds", String(seconds)]));
  console.log(JSON.stringify({ ...stats, window_ms: windowMs }));
} finally {
  spawnSync("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  if (working) {
    const listed = JSON.parse(hcQuiet("ls", "--json").stdout || "[]");
    for (const terminal of listed.terminals ?? listed) if (terminal.address) hcQuiet("kill", terminal.address);
    hcQuiet("server", "stop");
  }
  await sleep(1500);
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
