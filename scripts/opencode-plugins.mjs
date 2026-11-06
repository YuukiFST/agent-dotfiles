#!/usr/bin/env node
// Verify the OpenCode plugins this repo tracks.
//
// Usage: node scripts/opencode-plugins.mjs wait
//
// `opencode plugin list` asks the server for the plugins of the current directory, and a directory
// the server has not loaded yet answers with no server plugin at all. The CLI still prints what
// cli.json holds, so a cold answer shows only the TUI half of the goal plugin, with ID `-`.
// --standalone starts cold on every run, so polling the same directory is the reliable path.
import { spawnSync } from "node:child_process";

const PLUGINS = [
  "github:YuukiFST/caveman-lean",
  "github:YuukiFST/ponytail-subagent",
  "@prevalentware/opencode-goal-plugin",
];
const POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = Number(process.env.OPENCODE_PLUGINS_POLL_MS ?? 1000);

// shell: the npm shim on Windows is a .cmd. Every argument here is a constant from this file.
function opencode(...args) {
  return spawnSync(`opencode ${args.join(" ")}`, { encoding: "utf8", shell: true });
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// A row with ID `-` is the TUI half alone: the server half has not loaded.
function pluginsMissingFrom(listing) {
  const rows = listing.split(/\r?\n/).map((line) => line.trim().split(/\s+/));
  return PLUGINS.filter((plugin) => !rows.some((row) => row.at(-1) === plugin && row[0] !== "-"));
}

function waitForPlugins() {
  let previous = null;
  let missing = PLUGINS;
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt++) {
    const { status, stdout } = opencode("plugin", "list");
    missing = status === 0 ? pluginsMissingFrom(stdout) : PLUGINS;
    if (missing.length === 0 && stdout === previous) return stdout;
    previous = stdout;
    sleep(POLL_INTERVAL_MS);
  }
  console.error(`opencode plugin list never settled in ${process.cwd()} after ${POLL_ATTEMPTS} attempts.`);
  console.error(`Missing: ${missing.join(", ")}. Last answer:\n${previous}`);
  process.exit(1);
}

const [mode, ...extra] = process.argv.slice(2);
if (mode !== "wait" || extra.length > 0) {
  console.error("usage: opencode-plugins.mjs wait");
  process.exit(2);
}
process.stdout.write(waitForPlugins());
