// End-to-end tests: each one drives babysit.mjs through its CLI on a recorded snapshot.
// Source: the user's spec for this skill (2026-11-16): "um estado por PR, com regras fixas,
// e no máximo uma próxima ação por PR", "um registro (ledger) que impede agir duas vezes no
// mesmo commit", "um agente chamado só para consertar", "Comece em L0", and "Cobrar
// revisores sozinho: não adote ... a minha confirmação a cada vez".
// Regenerate the golden: UPDATE_GOLDEN=1 node --test skills/pr-babysit/scripts/babysit.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, "babysit.mjs");
const SNAPSHOT = path.join(here, "fixtures", "snapshot.json");
const GOLDEN = path.join(here, "fixtures", "tick-l0.golden.txt");
const NOW = "2026-11-16T14:00:00Z"; // a Monday, inside working hours in UTC
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "pr-babysit-test-"));
// Windows keeps a directory locked while a process runs in it, and the fake agent may still be exiting.
after(() => fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 }));

function babysit(args, env = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, TZ: "UTC", ...env } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function tick(stateDir, level, env) {
  return babysit(["tick", "--level", level, "--snapshot", SNAPSHOT, "--state-dir", stateDir, "--now", NOW], env);
}

function recordingDispatch(dir) {
  const log = path.join(dir, "dispatched.txt");
  const fake = path.join(dir, "fake-agent.mjs");
  fs.writeFileSync(fake, `import fs from "node:fs";\nfs.appendFileSync(${JSON.stringify(log)}, process.argv.slice(2).join(" ") + "\\n");\n`);
  return { log, env: { PR_BABYSIT_DISPATCH: JSON.stringify([process.execPath, fake, "{session}", "{brief}"]) } };
}

async function waitForLines(file, count) {
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8").trim().split("\n").length >= count) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

test("L0 puts each PR in one state, plans at most one action, and starts no agent", () => {
  const dir = fs.mkdtempSync(path.join(scratch, "l0-"));
  const { log, env } = recordingDispatch(dir);
  babysit(["register", "acme/app#3", "--session", "sess-3", "--cwd", dir, "--state-dir", dir]);
  const plan = tick(dir, "L0", env);
  if (process.env.UPDATE_GOLDEN) fs.writeFileSync(GOLDEN, plan);
  assert.equal(plan, fs.readFileSync(GOLDEN, "utf8").replace(/\r\n/g, "\n"));
  const brief = fs.readFileSync(path.join(dir, "briefs", "acme_app_3_3333333_fix-ci.md"), "utf8");
  assert.match(brief, /log: https:\/\/github.com\/acme\/app\/actions\/runs\/9\/job\/1/);
  assert.match(brief, /replies to reviewers are drafted in your report, not posted/);
  assert.equal(fs.existsSync(log), false, "L0 must not start an agent");
});

test("a second tick on the same head commit repeats no action", () => {
  const dir = fs.mkdtempSync(path.join(scratch, "ledger-"));
  tick(dir, "L0");
  const briefsBefore = fs.readdirSync(path.join(dir, "briefs")).length;
  const second = tick(dir, "L0");
  const acted = second.split("\n").filter((l) => l.includes(" -> ") && !l.includes("-> wait"));
  assert.equal(acted.length, 4);
  for (const line of acted) assert.match(line, /skipped \(ledger: done at this head\)$/);
  assert.match(second, /acme\/app#6 .*-> wait \(nudge asked less than 3 days ago\)/);
  assert.equal(fs.readdirSync(path.join(dir, "briefs")).length, briefsBefore);
});

test("L1 sends a fix only to the session registered for that PR, and still asks before any nudge", async () => {
  const dir = fs.mkdtempSync(path.join(scratch, "l1-"));
  const { log, env } = recordingDispatch(dir);
  babysit(["register", "acme/app#3", "--session", "sess-3", "--cwd", dir, "--state-dir", dir]);
  const plan = tick(dir, "L1", env);
  await waitForLines(log, 1);
  const dispatched = fs.readFileSync(log, "utf8").trim().split("\n");
  assert.equal(dispatched.length, 1);
  assert.match(dispatched[0], /^sess-3 .*acme_app_3_3333333_fix-ci\.md$/);
  assert.match(plan, /acme\/app#2 .* no session registered: hand the brief to an agent/);
  assert.match(plan, /acme\/app#6 .*-> ask:nudge .*question: ask reviewers/);
});
