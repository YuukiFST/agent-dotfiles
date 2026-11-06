#!/usr/bin/env node
// Differential oracle: the agent cards must show exactly what they showed before the
// git reads were reduced. Drives FlowByFolder from the pre-change revision and from the
// working tree over the same real repository, step by step, and diffs what each reports.
//   node .perf/verify/flow-differential.mjs [--rev 00803e7]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appHome = path.resolve(here, "..", "..");
const revFlag = process.argv.indexOf("--rev");
const rev = revFlag === -1 ? "00803e7" : process.argv[revFlag + 1];
const stubUrl = pathToFileURL(path.join(here, "flow-stub-herdr.mjs")).href;
registerHooks({ resolve: (spec, ctx, next) => (spec === "herdr" ? { url: stubUrl, shortCircuit: true } : next(spec, ctx)) });
const { spawned } = await import(stubUrl);

const work = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-flow-"));
const oldDir = path.join(work, "old");
fs.mkdirSync(oldDir);
for (const file of ["watch.js", "model.js"]) {
  fs.writeFileSync(path.join(oldDir, file), execFileSync("git", ["-C", appHome, "show", `${rev}:mods/agents-edited/flow/${file}`]));
}
fs.writeFileSync(path.join(oldDir, "package.json"), '{"type":"module"}');
const { FlowByFolder: Old } = await import(pathToFileURL(path.join(oldDir, "watch.js")).href);
const { FlowByFolder: New } = await import(pathToFileURL(path.join(appHome, "mods/agents-edited/flow/watch.js")).href);

const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=Perf Check", "-c", "user.email=perf@example.invalid", "-c", "core.hooksPath=NUL", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const remote = path.join(work, "remote.git");
const repo = path.join(work, "repo");
const worktree = path.join(work, "worktree");
const write = (file, text) => fs.writeFileSync(path.join(repo, file), text);
const commit = (cwd, message) => { git(cwd, "add", "-A"); git(cwd, "commit", "-q", "-m", message); };
git(work, "init", "-q", "--bare", "-b", "main", remote);
git(work, "clone", "-q", remote, repo);
git(repo, "checkout", "-q", "-B", "main");
write("a.txt", "one\ntwo\nthree\n");
write("b.txt", "bee\n");
commit(repo, "first");
git(repo, "push", "-q", "-u", "origin", "main");
git(repo, "remote", "set-head", "origin", "main");

let clock = Date.now();
Date.now = () => clock;
const cx = { spawn: (task) => task(cx), notify() {} };
const settle = async (flows) => { while (flows.running) await new Promise((resolve) => setTimeout(resolve, 5)); };
const entries = (cwd) => [{ address: "t1", cwd, busy: true }];
const [before, after] = [new Old(), new New()];

async function readBoth(cwd) {
  clock += 5000;
  const costs = [];
  const flowsRead = [];
  for (const flows of [before, after]) {
    const start = spawned.count;
    flows.tick(entries(cwd), cx);
    await settle(flows);
    costs.push(spawned.count - start);
    flowsRead.push(JSON.stringify(flows.of(cwd)));
  }
  return { costs, flowsRead };
}

const steps = [
  ["on the base", () => {}],
  ["on the base again", () => {}],
  ["feature branch", () => { git(repo, "checkout", "-q", "-b", "feat/x"); }],
  ["unchanged branch", () => {}],
  ["edited file", () => { write("a.txt", "one\nTWO\nthree\n"); }],
  ["untracked file", () => { write("c.txt", "new\n"); }],
  ["own commit", () => { commit(repo, "my change"); }],
  ["unchanged after commit", () => {}],
  ["base moved with a conflict", () => {
    git(repo, "checkout", "-q", "main");
    write("a.txt", "one\nDOS\nthree\n");
    write("b.txt", "BEE\n");
    commit(repo, "their change");
    git(repo, "push", "-q", "origin", "main");
    git(repo, "checkout", "-q", "feat/x");
  }],
  ["unchanged with conflict", () => {}],
  ["merge in progress", () => { try { git(repo, "merge", "main"); } catch { /* conflicts are the point */ } }],
  ["one file resolved", () => { write("a.txt", "one\nTWO\nthree\n"); git(repo, "add", "a.txt"); }],
  ["merge finished", () => { git(repo, "commit", "-q", "--no-edit"); }],
  ["merged and unchanged", () => {}],
  ["detached head", () => { git(repo, "checkout", "-q", "--detach"); }],
  ["back on the branch", () => { git(repo, "checkout", "-q", "feat/x"); }],
  ["back on the base", () => { git(repo, "checkout", "-q", "main"); }],
];

let failed = 0;
let gitCallsAfter = 0;
const line = (name, { costs, flowsRead }) => {
  const same = flowsRead[0] === flowsRead[1];
  gitCallsAfter += costs[1];
  if (!same) failed++;
  console.log(`${same ? "same" : "DIFF"}  git calls ${String(costs[0]).padStart(2)} -> ${String(costs[1]).padStart(2)}  ${name}`);
  if (!same) console.log(`  before ${flowsRead[0]}\n  after  ${flowsRead[1]}`);
};
try {
  for (const [name, change] of steps) {
    change();
    line(name, await readBoth(repo));
  }
  git(repo, "worktree", "add", "-q", "-b", "feat/y", worktree, "main");
  line("linked worktree", await readBoth(worktree));
  line("linked worktree unchanged", await readBoth(worktree));
} finally {
  fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
console.log(failed ? `${failed} step(s) differ` : "every step matches");
console.log(JSON.stringify({ git_calls: gitCallsAfter }));
process.exit(failed ? 1 : 0);
