// End-to-end tests: each one drives ratchet.mjs, probe.mjs or launch.mjs as the agent does,
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
const LAUNCH = path.join(here, "launch.mjs");
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
  const config = metrics.map((m) => ({ command: "node emit.js", pick: m.id, unit: "us", better: "lower", runs: 3, ...m }));
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
    assert.ok(result.private_mb_peak >= 150, `private_mb_peak ${result.private_mb_peak} should include the 150 MB buffer`);
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

// Source for the tests from here to the Valgrind ones, the user's words when
// asking for this skill to cover all performance work: "Metricas mostrando
// quantas vezes mais rapido (ex: 5.9x faster, 3.5x faster)", "é de extrema
// importancia que as metricas sejam feitas em micro-segundos", "nada de metricas
// falsas ou totalmente imprecisas", and the metrics they named: "First frame on
// screen", "Quit, to process gone", "Reading saved state at launch", "State-file
// calls per 100 keystrokes", "cpu while scrolling 5.000 lines".

function reportRow(stdout, id) {
  const row = stdout.split(/\r?\n/).find((line) => line.startsWith(`| ${id} `));
  assert.ok(row, `no report row for ${id} in:\n${stdout}`);
  const [, , baseline, current, change, speedup, sinceFirst, threshold, verdict] = row.split("|").map((cell) => cell.trim());
  return { baseline, current, change, speedup, sinceFirst, threshold, verdict };
}

test("the report says how many times faster, against the baseline and against the first value", () => {
  const root = scratchProject([{ id: "first_frame" }, { id: "state_calls", unit: "calls", stable: true }]);
  measureAndCheck(root, { first_frame: 590000, state_calls: 39 });
  const halfway = reportRow(measureAndCheck(root, { first_frame: 236000, state_calls: 39 }).stdout, "first_frame");
  assert.equal(halfway.speedup, "2.5x faster");
  const res = measureAndCheck(root, { first_frame: 100000, state_calls: 0 });
  assert.equal(res.status, 0, res.stderr);
  const frame = reportRow(res.stdout, "first_frame");
  assert.equal(frame.speedup, "2.4x faster");
  assert.match(frame.sinceFirst, /^5\.9x faster \(590,000 us at /);
  assert.equal(reportRow(res.stdout, "state_calls").speedup, "eliminated");
});

test("a change inside the noise threshold is not reported as a speedup", () => {
  const root = scratchProject([{ id: "first_frame" }]);
  measureAndCheck(root, { first_frame: 100000 });
  const row = reportRow(measureAndCheck(root, { first_frame: 97000 }).stdout, "first_frame");
  assert.deepEqual([row.verdict, row.speedup, row.sinceFirst], ["flat", "-", "-"]);
});

test("a time metric in milliseconds is refused", () => {
  const root = scratchProject([{ id: "startup", unit: "ms" }]);
  fs.writeFileSync(path.join(root, "values.json"), JSON.stringify({ startup: 100 }));
  const res = spawnSync(process.execPath, [RATCHET, "measure"], { cwd: root, encoding: "utf8" });
  assert.equal(res.status, 2);
  assert.match(res.stderr, /time is recorded in microseconds/);
});

test("a change smaller than the measurement's resolution moves nothing", () => {
  const root = scratchProject([{ id: "settled", resolution: 16667 }]);
  measureAndCheck(root, { settled: 100000 });
  const res = measureAndCheck(root, { settled: 115000 });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(reportRow(res.stdout, "settled").verdict, "flat");
  assert.equal(measureAndCheck(root, { settled: 120000 }).status, 1);
});

function writeScript(name, source) {
  const file = path.join(fs.mkdtempSync(path.join(scratchRoot, "app-")), name);
  fs.writeFileSync(file, source);
  return file;
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("probe charges the app's CPU time to the scenario that drove it", () => {
  const go = path.join(fs.mkdtempSync(path.join(scratchRoot, "go-")), "go");
  // Idle until the scenario asks for work, then exactly one second of CPU time by
  // the app's own account, however long the machine takes to grant it.
  const app = writeScript("app.js", `const fs = require("fs");
const cpuUs = () => { const used = process.cpuUsage(); return used.user + used.system; };
setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(go)})) return;
  const until = cpuUs() + 1_000_000;
  while (cpuUs() < until);
  fs.rmSync(${JSON.stringify(go)});
}, 50);
`);
  const scenario = writeScript("scenario.js", `const fs = require("fs");
fs.writeFileSync(${JSON.stringify(go)}, "");
const poll = setInterval(() => fs.existsSync(${JSON.stringify(go)}) || clearInterval(poll), 50);
`);
  const res = spawnSync(process.execPath, [PROBE, "--settle", "2", "--scenario", `"${process.execPath}" "${scenario}"`, "--", `"${process.execPath}"`, `"${app}"`], {
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(res.status, 0, res.stderr || res.error?.message);
  const result = JSON.parse(res.stdout.trim());
  assert.ok(result.cpu_us >= 950_000 && result.cpu_us <= 1_300_000, `cpu_us ${result.cpu_us} should be the one second of CPU the app burned`);
  assert.ok(result.scenario_us >= 1_000_000, `scenario_us ${result.scenario_us} should cover the second the work took`);
});

function launch(...args) {
  const res = spawnSync(process.execPath, [LAUNCH, ...args], { encoding: "utf8", timeout: 60_000 });
  return { ...res, result: res.status === 0 ? JSON.parse(res.stdout.trim()) : null };
}

// Reports like a real app: its clock starts at its first statement, the window
// comes 60 ms later, and it read saved state for 1234 us through 3 file calls.
const MARKED_APP = `const zero = process.hrtime.bigint();
const us = () => Number((process.hrtime.bigint() - zero) / 1000n);
const mainAt = us();
process.stdout.write("@perf mark main " + mainAt + "\\n");
setTimeout(() => {
  while (us() - mainAt < 60000); // setTimeout's millisecond clock can fire a little early on Windows
  process.stdout.write("@perf mark window " + us() + "\\n@perf span read_state 1234\\n@perf count state_file_calls 3\\n@perf done\\n");
}, 60);
setInterval(() => {}, 1000);
`;

test("launch times each mark from process creation and passes spans and counts through", () => {
  const { status, stderr, result } = launch("--", process.execPath, writeScript("app.js", MARKED_APP));
  assert.equal(status, 0, stderr);
  assert.ok(result.pre_main_us > 0 && result.pre_main_us < 10_000_000, `pre_main_us ${result.pre_main_us}`);
  assert.ok(result.main_us >= result.pre_main_us);
  const windowAfterMain = result.window_us - result.main_us;
  assert.ok(windowAfterMain >= 60_000 && windowAfterMain < 1_000_000, `window came ${windowAfterMain} us after main, the app waited 60 ms`);
  assert.equal(result.read_state_us, 1234);
  assert.equal(result.state_file_calls, 3);
});

test("launch refuses marks that sat in a buffer", () => {
  const app = writeScript("app.js", `setTimeout(() => process.stdout.write("@perf mark main 0\\n@perf mark window 60000\\n@perf done\\n"), 60);
setInterval(() => {}, 1000);
`);
  const { status, stderr } = launch("--", process.execPath, app);
  assert.equal(status, 2);
  assert.match(stderr, /buffers its output/);
});

// An app that takes 300 ms to shut down once asked: a window's FormClosing on
// Windows, a SIGTERM handler on Linux. Each writes its pid for the test.
function slowQuitApp(pidFile) {
  if (os.platform() === "win32") {
    const script = writeScript("app.ps1", `Add-Type -AssemblyName System.Windows.Forms
Set-Content -Path '${pidFile}' -Value $PID
$form = New-Object System.Windows.Forms.Form
$form.Add_Shown({ [Console]::Out.WriteLine('@perf mark window 1'); [Console]::Out.WriteLine('@perf done'); [Console]::Out.Flush() })
$form.Add_FormClosing({ Start-Sleep -Milliseconds 300 })
[System.Windows.Forms.Application]::Run($form)
`);
    return ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script];
  }
  const app = writeScript("app.js", `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on("SIGTERM", () => setTimeout(() => process.exit(0), 300));
process.stdout.write("@perf mark window 1\\n@perf done\\n");
setInterval(() => {}, 1000);
`);
  return [process.execPath, app];
}

test("launch --quit times a graceful close until the process is gone", { skip: os.platform() === "darwin" && "quit timing covers Windows and Linux" }, () => {
  const pidFile = path.join(fs.mkdtempSync(path.join(scratchRoot, "quit-")), "pid");
  const { status, stderr, result } = launch("--quit", "--", ...slowQuitApp(pidFile));
  assert.equal(status, 0, stderr);
  assert.ok(result.quit_us >= 300_000 && result.quit_us < 10_000_000, `quit_us ${result.quit_us} should cover the 300 ms shutdown`);
  assert.equal(pidAlive(Number(fs.readFileSync(pidFile, "utf8"))), false, "the app is still running");
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
