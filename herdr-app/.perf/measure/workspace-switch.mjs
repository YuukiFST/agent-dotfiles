#!/usr/bin/env node
// Time from asking for a workspace to the window's last pixel change, on a throwaway window with
// its own home and core session, so the person's windows and terminals stay out of it.
//   node .perf/measure/workspace-switch.mjs [--switches 6] [--patch <sh run in the copied mods>] [--verbose]
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
const switches = arg("switches", "6");
const patch = arg("patch");
const verbose = process.argv.includes("--verbose");

const session = `perf${process.pid}`;
const temp = path.join(os.tmpdir(), `herdr-switch-${process.pid}`);
const home = temp.replace(/\\/g, "/");
const programs = path.join(os.homedir(), "AppData", "Local", "Programs");
const exe = path.join(programs, "herdr-app", "herdr-app.exe");
const hc = path.join(programs, "herdr-core", "hc.exe");
const env = { ...process.env, HERDR_APP_HOME: temp, HC_SESSION: session, HERDR_APP_NO_SOUND: "1" };
const hcQuiet = (...args) => spawnSync(hc, args, { env, encoding: "utf8" });

fs.mkdirSync(path.join(temp, "layouts"), { recursive: true });
for (const file of ["settings.json", "keys.json", "installed.json", "seen.json", "update-notes.json"]) {
  fs.copyFileSync(path.join(appHome, file), path.join(temp, file));
}
for (const dir of ["themes", "fonts", "icons", "assets"]) fs.symlinkSync(path.join(appHome, dir), path.join(temp, dir), "junction");
fs.cpSync(path.join(appHome, "mods"), path.join(temp, "mods"), { recursive: true, filter: (p) => !p.endsWith(".d.ts") });
for (const name of ["sessions", "status"]) fs.copyFileSync(path.join(appHome, "layouts", `${name}.json`), path.join(temp, "layouts", `${name}.json`));

// The mod's second-window paths must not reach the person's other window.
const listFile = path.join(temp, "mods", "workspaces", "list.js");
const list = fs.readFileSync(listFile, "utf8")
  .replaceAll("${slash(home())}/.config/herdr-app-2", `${home}/absent-second-home`)
  .replaceAll("${slash(home())}/.config/herdr-app`", `${home}\``);
fs.writeFileSync(listFile, list);
if (patch) execFileSync("sh", ["-c", patch], { cwd: path.join(temp, "mods") });

const state = JSON.parse(fs.readFileSync(path.join(appHome, "shared.json"), "utf8"));
state.layout = "sessions";
fs.writeFileSync(path.join(temp, "shared.json"), JSON.stringify(state));
const windowState = JSON.parse(fs.readFileSync(path.join(appHome, "window.json"), "utf8"));
fs.writeFileSync(path.join(temp, "window.json"), JSON.stringify({ ...windowState, state: "normal", bounds: [120, 120, 1400, 800] }));

const started = hcQuiet("server", "start");
if (started.status !== 0) throw new Error(`core did not start: ${started.stderr}`);
const app = spawn(exe, [], { env, stdio: "ignore", detached: true });
app.unref();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  await sleep(Number(arg("settle", 12)) * 1000);
  const out = execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(here, "switch-frames.ps1"),
    "-AppId", String(app.pid), "-Exe", exe, "-Command", arg("command", "workspaces.next"), "-Switches", switches], { encoding: "utf8", env });
  const runs = out.trim().split(/\r?\n/).filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  if (verbose) for (const run of runs) console.error(JSON.stringify(run));
  const pick = (key) => median(runs.map((run) => run[key]));
  console.log(JSON.stringify({ first_change_ms: pick("first_change_ms"), settled_ms: pick("settled_ms"), trigger_ms: pick("trigger_ms"), frames: pick("frames") }));
} finally {
  spawnSync("taskkill", ["/PID", String(app.pid), "/T", "/F"], { stdio: "ignore" });
  const listed = JSON.parse(hcQuiet("ls", "--json").stdout || "[]");
  for (const terminal of listed.terminals ?? listed) if (terminal.address) hcQuiet("kill", terminal.address);
  hcQuiet("server", "stop");
  await sleep(1500);
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
