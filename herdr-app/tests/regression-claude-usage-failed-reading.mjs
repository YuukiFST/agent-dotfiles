#!/usr/bin/env node
// Reported bug: "eu troquei de conta do claude mas no meu Herdr app ainda está mostrando o uso da
// conta anterior". A reading that fails (no sign-in during the switch) kept the last account's
// windows. Runs usage-sample.mjs against a throwaway Claude config with no sign-in, over a file
// holding another account's reading, and diffs what it wrote against the golden beside this file.
//   node tests/regression-claude-usage-failed-reading.mjs [--update]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sampler = path.resolve(here, "..", "mods", "claude-usage", "usage-sample.mjs");
const golden = path.join(here, "regression-claude-usage-failed-reading.golden.txt");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-regression-"));
const configDir = path.join(temp, "claude");
const usageFile = path.join(temp, "plan-usage.json");
fs.mkdirSync(configDir);
const previousAccount = {
  at: 1794516135237,
  plan: "Ultra",
  windows: [{ kind: "week", label: "Week", percent: 66, resetsAt: 1794769200 }],
  error: null,
  checkedAt: 1794516135237,
};
fs.writeFileSync(usageFile, JSON.stringify(previousAccount));

const run = spawnSync(process.execPath, [sampler, usageFile], {
  env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
  encoding: "utf8",
});
const written = JSON.parse(fs.readFileSync(usageFile, "utf8"));
fs.rmSync(temp, { recursive: true, force: true });

const seen = [
  `exit: ${run.status}`,
  `error: ${written.error}`,
  `plan: ${written.plan ?? "(none)"}`,
  `windows: ${JSON.stringify(written.windows ?? null)}`,
  `checkedAt: ${typeof written.checkedAt}`,
].join("\n") + "\n";

if (process.argv.includes("--update")) {
  fs.writeFileSync(golden, seen);
  process.stdout.write(seen);
  process.exit(0);
}
const expected = fs.readFileSync(golden, "utf8").replace(/\r\n/g, "\n");
if (seen === expected) {
  process.stdout.write("ok\n");
  process.exit(0);
}
process.stdout.write(`--- golden\n${expected}+++ seen\n${seen}`);
process.exit(1);
