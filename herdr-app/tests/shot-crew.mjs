#!/usr/bin/env node
// Shoots the Sessions layout in one state of the crew mod's sidebar, with fixture crew.json and
// decisions.json written beside the throwaway home: the real orchestrator state is never read.
//   node tests/shot-crew.mjs <state> <out.png> [--window <window.json>] [--settle <ms>]
// <state>: sessions | empty | full | done (Finished expanded) | rail (the 44px sidebar).
// The window copies ~/.config/herdr-app (settings, data, icons, fonts, the other mods), then this
// checkout's mods and layouts over it, joins the running core read-only, and quits after.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATES = new Set(["sessions", "empty", "full", "done", "rail"]);
const [state, outArg] = process.argv.slice(2);
const option = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
if (!STATES.has(state) || !outArg) {
  console.error(`usage: node tests/shot-crew.mjs <${[...STATES].join(" | ")}> <out.png> [--window <window.json>] [--settle <ms>]`);
  process.exit(2);
}
const out = path.resolve(outArg);
const checkout = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appHome = path.join(os.homedir(), ".config", "herdr-app");
const appExe = path.join(os.homedir(), "AppData", "Local", "Programs", "herdr-app", "herdr-app.exe");
const windowFile = option("--window", path.join(appHome, "window.json"));
const settleMs = Number(option("--settle", "10000"));

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const repo = "C:/Users/Desenvolvimento/.config/herdr-app";
const crewmate = (name, status, spawnedMin, atMin, extra) =>
  ({ name, model: "opus", effort: "medium", repo, spawned: minutesAgo(spawnedMin), status, at: minutesAgo(atMin), report: false, progress: null, ...extra });
const FULL_CREW = {
  max: 2,
  crew: [
    crewmate("orch-tab", "running", 42, 42, { progress: "15:40 | [3/5] Orchestration tab drawn | next: alignment screenshots" }),
    crewmate("api-fix", "blocked", 95, 12, { progress: "15:55 | [2/4] integration tests | next: waiting on the merge decision" }),
    crewmate("crew-panel", "stopped", 240, 200, { report: true, progress: "10:38 | done: report written (report.md) | next: nothing; end of turn" }),
    crewmate("docs-pass", "report", 400, 300, { report: true, effort: "high", progress: "09:10 | done: README | next: nothing" }),
  ],
};
const FULL_DECISIONS = {
  open: [
    {
      id: "ratchet-33c99ed", question: "When to run the perf ratchet for the Crew panel (33c99ed, already on master)?", crewmate: "crew-panel",
      options: [
        { label: "When memory frees up", effect: "I run it once web-app finishes.", recommended: true },
        { label: "Now", effect: "Measures with the machine in Low memory.", recommended: false },
        { label: "Do not run", effect: null, recommended: false },
      ],
      asked: minutesAgo(30),
    },
    {
      id: "merge-api-fix", question: "Merge api-fix with the integration tests still pending?", crewmate: null,
      options: [
        { label: "Wait for the tests", effect: "The merge moves to tomorrow.", recommended: false },
        { label: "Merge now", effect: "The tests run on master.", recommended: false },
      ],
      asked: minutesAgo(12),
    },
  ],
  resolved: [],
};

const home = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-shot-"));
for (const file of ["settings.json", "keys.json", "installed.json", "seen.json"]) fs.copyFileSync(path.join(appHome, file), path.join(home, file));
for (const dir of ["mods", "layouts", "themes", "icons", "fonts", "assets", "data", "frame"]) {
  if (fs.existsSync(path.join(appHome, dir))) fs.cpSync(path.join(appHome, dir), path.join(home, dir), { recursive: true, dereference: true });
}
for (const dir of ["mods", "layouts"]) fs.cpSync(path.join(checkout, dir), path.join(home, dir), { recursive: true, dereference: true });
if (fs.existsSync(windowFile)) fs.copyFileSync(windowFile, path.join(home, "window.json"));

// The fixtures sit in a state folder of their own, as the orchestrator's do.
const stateDir = path.join(home, "crew-state");
fs.mkdirSync(stateDir);
const crewFile = path.join(stateDir, "crew.json").replaceAll("\\", "/");
const decisionsFile = path.join(stateDir, "decisions.json").replaceAll("\\", "/");
const isEmpty = state === "empty";
fs.writeFileSync(crewFile, JSON.stringify(isEmpty ? { max: 2, crew: [] } : FULL_CREW, null, 2));
if (!isEmpty) fs.writeFileSync(decisionsFile, JSON.stringify(FULL_DECISIONS, null, 2));

// Every crew block of the copied layout reads the fixtures.
const layoutFile = path.join(home, "layouts", "sessions.json");
const withFixtures = (node) => {
  if (node?.content?.mod === "crew") node.content.props = { ...node.content.props, crewFile, decisionsFile };
  for (const child of node?.children ?? []) withFixtures(child);
  return node;
};
fs.writeFileSync(layoutFile, JSON.stringify(withFixtures(JSON.parse(fs.readFileSync(layoutFile, "utf8"))), null, 2));
const shared = JSON.parse(fs.readFileSync(path.join(appHome, "shared.json"), "utf8"));
fs.writeFileSync(path.join(home, "shared.json"), JSON.stringify({ ...shared, layout: "sessions" }));

const env = { ...process.env, HERDR_APP_HOME: home };
const call = (args) => spawnSync(appExe, args, { env, encoding: "utf8" }).stdout ?? "";
const run = (command, args) => call(["do", command, JSON.stringify(args ?? {})]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const window = spawn(appExe, [], { env, stdio: "ignore", detached: true });
window.unref();
try {
  for (let i = 0; i < 80 && !call(["status"]).includes('"layout"'); i++) await sleep(250);
  await sleep(settleMs);
  if (state !== "sessions") run("layout.select", { stack: "sidebar-view", child: "orchestration" });
  if (state === "done") run("crew.toggle-finished");
  if (state === "rail") run("layout.resize", { id: "sidebar", px: 44 });
  await sleep(1500);
  const status = JSON.parse(call(["status"]));
  if (status.layout !== "sessions") throw new Error(`the window shows layout ${status.layout}, not sessions`);
  console.log(`status.errors: ${JSON.stringify(status.errors)}`);
  call(["shot", out]);
  console.log(out);
} finally {
  call(["do", "app.quit"]);
  await sleep(1000);
  spawnSync("taskkill", ["/PID", String(window.pid), "/T", "/F"], { stdio: "ignore" });
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
