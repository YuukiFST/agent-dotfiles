#!/usr/bin/env node
// Shoots one layout in a throwaway window, for checking a mod's alignment against its neighbours.
// The window copies this home's mods and data, joins the running core read-only, and quits after.
//   node tests/shot-layout.mjs <layout> <out.png> [--window <window.json>] [--settle <ms>]
// --window takes the geometry of the window the person sees (a maximized second monitor is
// ~/.config/herdr-app-2/window.json); without it the shot is this home's window.json size.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [layout, outArg] = process.argv.slice(2);
const option = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
if (!layout || !outArg) {
  console.error("usage: node tests/shot-layout.mjs <layout> <out.png> [--window <window.json>] [--settle <ms>]");
  process.exit(2);
}
const out = path.resolve(outArg);
const appHome = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appExe = path.join(os.homedir(), "AppData", "Local", "Programs", "herdr-app", "herdr-app.exe");
const windowFile = option("--window", path.join(appHome, "window.json"));
const settleMs = Number(option("--settle", "10000"));

const home = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-shot-"));
for (const file of ["settings.json", "keys.json", "installed.json", "seen.json"]) fs.copyFileSync(path.join(appHome, file), path.join(home, file));
for (const dir of ["mods", "layouts", "themes", "icons", "fonts", "assets", "data"]) {
  if (fs.existsSync(path.join(appHome, dir))) fs.cpSync(path.join(appHome, dir), path.join(home, dir), { recursive: true, dereference: true });
}
if (fs.existsSync(windowFile)) fs.copyFileSync(windowFile, path.join(home, "window.json"));
const state = JSON.parse(fs.readFileSync(path.join(appHome, "shared.json"), "utf8"));
fs.writeFileSync(path.join(home, "shared.json"), JSON.stringify({ ...state, layout }));

const env = { ...process.env, HERDR_APP_HOME: home };
const call = (args) => spawnSync(appExe, args, { env, encoding: "utf8" }).stdout ?? "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const window = spawn(appExe, [], { env, stdio: "ignore", detached: true });
window.unref();
try {
  for (let i = 0; i < 80 && !call(["status"]).includes('"layout"'); i++) await sleep(250);
  await sleep(settleMs);
  const status = JSON.parse(call(["status"]));
  if (status.layout !== layout) throw new Error(`the window shows layout ${status.layout}, not ${layout}`);
  if (status.errors.length) console.error(JSON.stringify(status.errors));
  call(["shot", out]);
  console.log(out);
} finally {
  call(["do", "app.quit"]);
  await sleep(1000);
  spawnSync("taskkill", ["/PID", String(window.pid), "/T", "/F"], { stdio: "ignore" });
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
