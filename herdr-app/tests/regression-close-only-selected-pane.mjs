#!/usr/bin/env node
// Reported bug: "quando eu estou trabalhando com duas sessões uma ao lado da outra e clico para
// fechar o painel de uma, a outra também fecha". Runs a throwaway window on its own core, so the
// person's terminals are out of reach, and diffs what it saw against the golden beside this file.
//   node tests/regression-close-only-selected-pane.mjs [--update]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appHome = path.resolve(here, "..");
const golden = path.join(here, "regression-close-only-selected-pane.golden.txt");
const programs = path.join(os.homedir(), "AppData", "Local", "Programs");
const appExe = path.join(programs, "herdr-app", "herdr-app.exe");
const hcExe = path.join(programs, "herdr-core", "hc.exe");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-regression-"));
const home = path.join(temp, "home");
const session = `regression${process.pid}`;
const env = { ...process.env, HERDR_APP_HOME: home, HC_SESSION: session };
delete env.HC_TERMINAL_SOCKET;
delete env.HC_TERMINAL_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const call = (exe, args) => spawnSync(exe, args, { env, encoding: "utf8" }).stdout;
const app = (...args) => JSON.parse(call(appExe, args));
const hc = (...args) => call(hcExe, args);
const terminalsOf = () => JSON.parse(hc("ls", "--all", "--json")).terminals;
const stateOf = (name) => terminalsOf().find((t) => t.address === name || t.name === name);
const shownPanes = () => app("ls").spaces.flatMap((s) => s.tabs.flatMap((t) => t.terminals));
async function keepsPrinting(terminal) {
  const before = hc("read", terminal);
  await sleep(2500);
  return hc("read", terminal) !== before;
}
const paneOf = (terminal) => shownPanes().find((p) => p.terminal === terminal)?.pane;

async function until(check, what) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}`);
}

function copyHome() {
  fs.mkdirSync(home, { recursive: true });
  for (const file of ["settings.json", "keys.json", "installed.json", "seen.json"]) fs.copyFileSync(path.join(appHome, file), path.join(home, file));
  for (const dir of ["mods", "layouts", "themes", "icons", "fonts", "assets"]) fs.cpSync(path.join(appHome, dir), path.join(home, dir), { recursive: true });
  const state = JSON.parse(fs.readFileSync(path.join(appHome, "shared.json"), "utf8"));
  fs.writeFileSync(path.join(home, "shared.json"), JSON.stringify({ ...state, layout: "sessions" }));
}

async function childBeside(parent, name) {
  hc("send", parent, `& '${hcExe}' run --bg --name ${name} 'powershell -NoProfile'`);
  await until(() => stateOf(name)?.state === "live", `child ${name}`);
  const child = stateOf(name).address;
  app("do", "pane.focus", "--pane", paneOf(parent));
  await sleep(300);
  app("do", "terminal.keep", "--terminal", child, "--place", "right");
  await until(() => paneOf(child), `a pane for ${name}`);
  return child;
}

async function closeFocused(terminal) {
  app("do", "pane.focus", "--pane", paneOf(terminal));
  await sleep(300);
  app("do", "pane-info.close");
  await until(() => !paneOf(terminal), `${terminal}'s pane to close`);
  await sleep(1500);
}

const report = [];
const line = (label, value) => report.push(`${label}: ${value}`);
const facts = (terminal) => `state=${stateOf(terminal).state} pane=${paneOf(terminal) ? "shown" : "none"}`;

let window;
try {
  copyHome();
  call(hcExe, ["server", "start"]);
  window = spawn(appExe, [], { env, stdio: "ignore", detached: true });
  window.unref();
  await until(() => call(appExe, ["status"]).includes('"layout"'), "the window");

  const first = app("do", "space.new", "--name", "regression", "--folder", os.homedir()).terminal;
  await until(() => paneOf(first), "the first pane");
  const neighbor = app("do", "pane.split", "--direction", "right").terminal;
  await until(() => paneOf(neighbor), "the neighbor pane");
  await closeFocused(neighbor);
  line("unrelated neighbor closed, closed one", facts(neighbor));
  line("unrelated neighbor closed, other one", facts(first));

  const child = await childBeside(first, "beside");
  await closeFocused(child);
  line("child closed, child", facts(child));
  line("child closed, parent", facts(first));

  const survivor = await childBeside(first, "survivor");
  hc("send", first, "ping -t 127.0.0.1");
  await sleep(1500);
  if (!(await keepsPrinting(first))) throw new Error("the parent never started working");
  await closeFocused(first);
  await sleep(1500);
  line("parent closed, parent", `pane=${paneOf(first) ? "shown" : "none"} still working=${await keepsPrinting(first)}`);
  line("parent closed, child beside it", facts(survivor));

  const stays = app("do", "pane.split", "--direction", "right", "--pane", paneOf(survivor)).terminal;
  await until(() => paneOf(stays), "another pane, so the child's isn't the space's last");
  await closeFocused(survivor);
  await until(() => stateOf(first).state !== "live", "the closed parent to end with its last shown child");
  line("last shown child closed, parent", `state=${stateOf(first).state}`);
} finally {
  spawnSync(appExe, ["do", "app.quit"], { env });
  await sleep(1000);
  if (window?.pid) spawnSync("taskkill", ["/PID", String(window.pid), "/T", "/F"], { stdio: "ignore" });
  call(hcExe, ["server", "stop"]);
  await sleep(1000);
  fs.rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  fs.rmSync(path.join(os.homedir(), "AppData", "Local", "herdr-core", session), { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}

const seen = `${report.join("\n")}\n`;
if (process.argv.includes("--update")) fs.writeFileSync(golden, seen);
const expected = fs.readFileSync(golden, "utf8");
process.stdout.write(seen);
if (seen !== expected) {
  console.error(`FAIL: differs from ${golden}\n--- expected\n${expected}`);
  process.exit(1);
}
console.log("PASS");
