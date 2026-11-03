// End-to-end tests: each one drives ratchet.mjs and probe.mjs as the agent does,
// through the CLI, in a scratch project.
// Source: the user's request for this skill, "garantir que a performance NUNCA
// regrida, e sempre que as metricas melhorarem, essas metricas melhores se
// tornarão as novas baselines", plus RAM and CPU named among the metrics.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const RATCHET = path.join(here, "ratchet.mjs");
const PROBE = path.join(here, "probe.mjs");
const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "perf-ratchet-test-"));
after(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

// A project whose metrics print whatever values.json holds, so a test sets the
// "measured" performance directly.
function scratchProject(metrics) {
  const root = fs.mkdtempSync(path.join(scratchRoot, "project-"));
  fs.mkdirSync(path.join(root, ".perf"));
  fs.writeFileSync(
    path.join(root, "emit.js"),
    'process.stdout.write(require("fs").readFileSync(__dirname + "/values.json", "utf8"));\n',
  );
  const config = metrics.map((m) => ({ command: "node emit.js", pick: m.id, unit: "ms", better: "lower", runs: 3, ...m }));
  fs.writeFileSync(path.join(root, ".perf", "ratchet.json"), JSON.stringify({ metrics: config }));
  return root;
}

function measureAndCheck(root, values, ...checkFlags) {
  fs.writeFileSync(path.join(root, "values.json"), JSON.stringify(values));
  const measured = spawnSync(process.execPath, [RATCHET, "measure"], { cwd: root, encoding: "utf8" });
  assert.equal(measured.status, 0, measured.stderr);
  return spawnSync(process.execPath, [RATCHET, "check", ...checkFlags], { cwd: root, encoding: "utf8" });
}

function baselineMedian(root, id) {
  const { buckets } = JSON.parse(fs.readFileSync(path.join(root, ".perf", "baselines.json"), "utf8"));
  const bucket = Object.values(buckets).find((b) => b.metrics[id]);
  return bucket?.metrics[id].median;
}

test("first check on a machine records the baseline", () => {
  const root = scratchProject([{ id: "startup" }]);
  const res = measureAndCheck(root, { startup: 100 });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /\| startup .*\| new \|/);
  assert.equal(baselineMedian(root, "startup"), 100);
});

test("a regression past the threshold fails and leaves the baseline alone", () => {
  const root = scratchProject([{ id: "startup" }]);
  measureAndCheck(root, { startup: 100 });
  const res = measureAndCheck(root, { startup: 110 });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /FAIL: startup regressed/);
  assert.equal(baselineMedian(root, "startup"), 100);
});

test("an improvement past the threshold becomes the new baseline", () => {
  const root = scratchProject([{ id: "startup" }, { id: "fps", unit: "fps", better: "higher" }]);
  measureAndCheck(root, { startup: 100, fps: 50 });
  const res = measureAndCheck(root, { startup: 80, fps: 60 });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(baselineMedian(root, "startup"), 80);
  assert.equal(baselineMedian(root, "fps"), 60);
  // The ratchet only turns one way: falling back to the old numbers now fails.
  assert.equal(measureAndCheck(root, { startup: 100, fps: 50 }).status, 1);
});

test("a change inside the tolerance keeps the old baseline", () => {
  const root = scratchProject([{ id: "startup" }]);
  measureAndCheck(root, { startup: 100 });
  const res = measureAndCheck(root, { startup: 97 });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /\| flat \|/);
  assert.equal(baselineMedian(root, "startup"), 100);
});

test("one regression blocks promoting another metric's improvement", () => {
  const root = scratchProject([{ id: "startup" }, { id: "ram", unit: "MB" }]);
  measureAndCheck(root, { startup: 100, ram: 300 });
  const res = measureAndCheck(root, { startup: 120, ram: 200 });
  assert.equal(res.status, 1);
  assert.equal(baselineMedian(root, "ram"), 300);
});

test("--no-promote gates without writing baselines, as CI runs it", () => {
  const root = scratchProject([{ id: "bundle", unit: "KB", stable: true }]);
  measureAndCheck(root, { bundle: 500 });
  assert.equal(measureAndCheck(root, { bundle: 400 }, "--no-promote").status, 0);
  assert.equal(baselineMedian(root, "bundle"), 500);
  assert.equal(measureAndCheck(root, { bundle: 501 }, "--no-promote").status, 1);
});

test("check refuses a run that skipped a configured metric", () => {
  const root = scratchProject([{ id: "startup" }, { id: "lcp", command: undefined, pick: undefined }]);
  const res = measureAndCheck(root, { startup: 100 });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /unmeasured: lcp/);
  const recorded = spawnSync(process.execPath, [RATCHET, "record", "lcp", "1200", "1250", "1190"], { cwd: root, encoding: "utf8" });
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.equal(spawnSync(process.execPath, [RATCHET, "check"], { cwd: root, encoding: "utf8" }).status, 0);
  assert.equal(baselineMedian(root, "lcp"), 1200);
});

test("probe reads the memory of a launched app and stops it afterwards", () => {
  const scratch = fs.mkdtempSync(path.join(scratchRoot, "probe-"));
  const app = path.join(scratch, "app.js");
  const heartbeat = path.join(scratch, "heartbeat");
  fs.writeFileSync(app, `globalThis.ballast = Buffer.alloc(150 * 2 ** 20, 1);
setInterval(() => require("fs").writeFileSync(${JSON.stringify(heartbeat)}, Date.now() + " " + process.pid), 200);
`);
  const readBeat = () => fs.readFileSync(heartbeat, "utf8").split(" ").map(Number);
  try {
    const res = spawnSync(process.execPath, [PROBE, "--settle", "2", "--duration", "2", "--", `"${process.execPath}"`, `"${app}"`], {
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(res.status, 0, res.stderr || res.error?.message);
    const result = JSON.parse(res.stdout.trim());
    assert.ok(result.rss_mb_peak >= 150, `rss_mb_peak ${result.rss_mb_peak} should include the 150 MB buffer`);
    assert.ok(result.cpu_pct_mean >= 0);
    const [lastBeat] = readBeat();
    spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1000)"]);
    assert.equal(readBeat()[0], lastBeat, "the app kept running after probe exited");
  } finally {
    // The app outlives a broken probe; stop it so a red run leaves nothing behind.
    if (fs.existsSync(heartbeat)) {
      try {
        process.kill(readBeat()[1]);
      } catch {
        // already stopped, as a passing run leaves it
      }
    }
  }
});

test("a metric bound to another OS is skipped instead of failing the gate", () => {
  const otherOs = os.platform() === "linux" ? "win32" : "linux";
  const root = scratchProject([{ id: "startup" }, { id: "instructions", unit: "Ir", stable: true, platforms: [otherOs] }]);
  const res = measureAndCheck(root, { startup: 100, instructions: 5 });
  assert.equal(res.status, 0, res.stderr);
  assert.ok(res.stderr.includes(`skipped on ${os.platform()}: instructions (${otherOs} only)`), res.stderr);
  assert.doesNotMatch(res.stdout, /\| instructions /);
});

// Valgrind runs on Linux only; CI installs it on its Ubuntu job.
const COUNT = path.join(here, "count.mjs");
const hasValgrind = os.platform() === "linux" && spawnSync("valgrind", ["--version"]).status === 0 && spawnSync("cc", ["--version"]).status === 0;

function compileAllocator() {
  const dir = fs.mkdtempSync(path.join(scratchRoot, "count-"));
  const source = path.join(dir, "alloc.c");
  // Allocates argv[1] blocks of 64 bytes, so a test controls the real heap use.
  fs.writeFileSync(source, `#include <stdlib.h>
int main(int argc, char **argv) {
  int n = atoi(argv[1]);
  for (int i = 0; i < n; i++) { volatile char *p = malloc(64); p[0] = 1; free((void *)p); }
  return 0;
}
`);
  const binary = path.join(dir, "alloc");
  const built = spawnSync("cc", ["-O0", "-o", binary, source], { encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr);
  return binary;
}

function count(mode, binary, n) {
  const res = spawnSync(process.execPath, [COUNT, mode, "--", binary, String(n)], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout.trim());
}

test("count reports exactly the heap blocks a program allocates", { skip: !hasValgrind && "needs Linux with valgrind and cc" }, () => {
  const binary = compileAllocator();
  const ten = count("heap", binary, 10);
  const twenty = count("heap", binary, 20);
  assert.equal(twenty.heap_blocks - ten.heap_blocks, 10);
  assert.equal(twenty.heap_bytes - ten.heap_bytes, 640);
});

test("count gives the same instruction count on every run of the same input", { skip: !hasValgrind && "needs Linux with valgrind and cc" }, () => {
  const binary = compileAllocator();
  const first = count("instructions", binary, 1000);
  assert.equal(count("instructions", binary, 1000).instructions, first.instructions);
  assert.ok(first.instructions > count("instructions", binary, 10).instructions);
});
