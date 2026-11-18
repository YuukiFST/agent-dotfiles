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
  // Review text that carries its own fence stays inside the data block.
  const review = fs.readFileSync(path.join(dir, "briefs", "acme_app_5_5555555_fix-review.md"), "utf8");
  const outsideFences = review.replace(/^(`{3,})text\n[\s\S]*?\n\1$/gm, "");
  assert.match(review, /^````text\nRename fetchAll/m);
  assert.equal(outsideFences.match(/^## Done when$/gm).length, 1);
});

test("a later tick on the same head commit repeats no action, and handled feedback frees the merge question", () => {
  const dir = fs.mkdtempSync(path.join(scratch, "ledger-"));
  tick(dir, "L0");
  const briefsBefore = fs.readdirSync(path.join(dir, "briefs")).length;
  const second = tick(dir, "L0");
  assert.match(second, /acme\/app#10 \S+ ready .*-> ask:merge/);
  assert.match(second, /acme\/app#6 .*-> wait \(nudge asked less than 3 days ago\)/);
  assert.match(second, /acme\/app#5 \S+ awaiting-review .*-> wait \(review requested 0h ago\)/);
  const third = tick(dir, "L0");
  const acted = third.split("\n").filter((l) => l.includes(" -> ") && !l.includes("-> wait"));
  assert.equal(acted.length, 4);
  for (const line of acted) assert.match(line, /skipped \(ledger: done at this head\)$/);
  assert.equal(fs.readdirSync(path.join(dir, "briefs")).length, briefsBefore);
});

test("a fix agent that fails to start is reported and retried, not recorded as done", () => {
  const dir = fs.mkdtempSync(path.join(scratch, "fail-"));
  babysit(["register", "acme/app#3", "--session", "sess-3", "--cwd", dir, "--state-dir", dir]);
  const env = { PR_BABYSIT_DISPATCH: JSON.stringify(["pr-babysit-no-such-agent", "{brief}"]) };
  for (let i = 0; i < 2; i++) assert.match(tick(dir, "L1", env), /acme\/app#3 .*-> fix:ci dispatch failed \(ENOENT\)/);
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

// Source: the user's go-ahead (2026-11-18) on the Claude Code team's rule, "If a check is still
// failing after three rounds, Claude stops and brings in a human" (claude.dev/blog/how-the-claude-code-team-thinks-about-verification).
test("a fix sent for 3 earlier commits of a PR becomes a question to you, not a 4th fix", () => {
  const seed = (dir, heads, mode) => {
    const lines = heads.map((head, i) =>
      JSON.stringify({ key: `acme/app#3@${head}:fix:ci:${mode}`, pr: "acme/app#3", head, action: "fix:ci", level: "L0", at: `2026-11-1${i}T10:00:00.000Z` }),
    );
    fs.writeFileSync(path.join(dir, "ledger.jsonl"), lines.join("\n") + "\n");
  };
  const stuck = fs.mkdtempSync(path.join(scratch, "rounds-3-"));
  seed(stuck, ["aaa0001", "aaa0002", "aaa0003"], "dry");
  const plan = tick(stuck, "L0");
  assert.match(plan, /acme\/app#3 3333333 ci-red .*-> ask:help \(fix:ci already sent for 3 earlier commits: test; ci\/legacy\) question: the fix agent is not converging on acme\/app#3/);
  assert.equal(fs.existsSync(path.join(stuck, "briefs", "acme_app_3_3333333_fix-ci.md")), false);
  assert.match(tick(stuck, "L0"), /acme\/app#3 .*-> ask:help skipped \(ledger: done at this head\)/);

  const two = fs.mkdtempSync(path.join(scratch, "rounds-2-"));
  seed(two, ["aaa0001", "aaa0002"], "dry");
  assert.match(tick(two, "L0"), /acme\/app#3 3333333 ci-red .*-> fix:ci \(test; ci\/legacy\)/);

  const otherMode = fs.mkdtempSync(path.join(scratch, "rounds-live-"));
  seed(otherMode, ["aaa0001", "aaa0002", "aaa0003"], "live");
  assert.match(tick(otherMode, "L0"), /acme\/app#3 3333333 ci-red .*-> fix:ci \(test; ci\/legacy\)/);
});
