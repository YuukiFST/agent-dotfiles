#!/usr/bin/env node
/**
 * Real-task benchmark for pi ponytail vs baseline.
 *
 * Uses a multi-file URL shortener fixture with hidden oracle tests.
 * Agent edits stubs; oracle runs after session to measure pass/fail.
 *
 * Usage:
 *   node benchmark-pi-real.js --selftest
 *   node benchmark-pi-real.js --model cursor/grok-4.5 --repeat 3 --arms baseline,ponytail-default,ponytail-full
 */

const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const VENDOR = path.join(ROOT, ".vendor", "ponytail");
const PI = process.env.PI_BIN || path.join(os.homedir(), ".pi/agent/node_modules/.bin/pi");
const PI_CWD = process.env.PI_CWD || path.join(os.homedir(), ".pi/agent");
const TASK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per cell
const ORACLE_TIMEOUT_MS = 60 * 1000;

const FIXTURE = path.join(ROOT, "fixtures", "url-shortener");
const ORACLE = path.join(ROOT, "oracle", "url-shortener");
const REFERENCES = path.join(ROOT, "references", "url-shortener");

const USER_PROMPT = fs.readFileSync(path.join(FIXTURE, "TASK.md"), "utf8").trim();

// Arm-neutral suffix: tells agent what to do without mentioning oracle.
const SUFFIX =
  "\n\nImplement the ticket in this repo. Edit files in place. Do not invent extra features. Stop when the ticket is done.";

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------

function loadPonytailInstructions() {
  const mod = path.join(VENDOR, "hooks", "ponytail-instructions.js");
  if (!fs.existsSync(mod)) {
    throw new Error(`Missing ${mod}. Run setup.sh first.`);
  }
  return require(mod);
}

function buildArms() {
  const baseline = require("./arms/baseline.js");
  const ponytailArm = require("./arms/ponytail.js");
  let getPonytailInstructions;
  try {
    getPonytailInstructions = loadPonytailInstructions().getPonytailInstructions;
  } catch (e) {
    if (process.argv.includes("--help") || process.argv.includes("-h")) throw e;
    console.error(e.message);
    process.exit(1);
  }

  return {
    baseline: () => {
      const msgs = baseline({ vars: { task: USER_PROMPT } });
      const system = msgs.find((m) => m.role === "system")?.content || "";
      return { systemPrompt: system ? system + SUFFIX : SUFFIX.trim(), userPrompt: USER_PROMPT };
    },
    "ponytail-default": () => {
      const msgs = ponytailArm({ vars: { task: USER_PROMPT } });
      const system = msgs.find((m) => m.role === "system")?.content || "";
      return { systemPrompt: system ? system + SUFFIX : SUFFIX.trim(), userPrompt: USER_PROMPT };
    },
    "ponytail-full": () => ({
      systemPrompt: getPonytailInstructions("full") + SUFFIX,
      userPrompt: USER_PROMPT,
    }),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    repeat: 1,
    model: "cursor/composer-2-5",
    piCwd: PI_CWD,
    arms: ["baseline", "ponytail-default", "ponytail-full"],
    selftest: false,
    keepFailed: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--selftest") opts.selftest = true;
    else if (a === "--repeat") opts.repeat = Number(argv[++i]);
    else if (a === "--model") opts.model = argv[++i];
    else if (a === "--pi-cwd") opts.piCwd = argv[++i];
    else if (a === "--arms") opts.arms = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--keep-failed") opts.keepFailed = true;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node benchmark-pi-real.js [--selftest] [--repeat N] [--model cursor/MODEL] [--arms baseline,ponytail-default,ponytail-full] [--keep-failed]`);
      process.exit(0);
    }
  }
  if (!Number.isFinite(opts.repeat) || opts.repeat < 1) throw new Error("--repeat must be positive integer");
  return opts;
}

// ---------------------------------------------------------------------------
// Workdir helpers
// ---------------------------------------------------------------------------

function createWorkdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-real-"));
  // Copy fixture
  fs.cpSync(FIXTURE, dir, { recursive: true });
  // git init for LOC measurement later
  spawnSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  spawnSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
  spawnSync("git", ["commit", "-m", "init", "--allow-empty"], { cwd: dir, stdio: "ignore" });
  return dir;
}

function installDeps(workdir) {
  // Use fixture's package.json; install silently
  spawnSync("npm", ["install", "--silent"], { cwd: workdir, stdio: "ignore", timeout: 120_000 });
}

function overlayOracle(workdir) {
  // Copy oracle tests into workdir/test/
  fs.cpSync(path.join(ORACLE, "test"), path.join(workdir, "test"), { recursive: true });
}

function overlayReference(workdir, variant) {
  // Copy reference src/ over the fixture src/
  const refSrc = path.join(REFERENCES, variant, "src");
  fs.rmSync(path.join(workdir, "src"), { recursive: true });
  fs.cpSync(refSrc, path.join(workdir, "src"), { recursive: true });
}

function countSrcLoc(workdir) {
  const result = spawnSync("git", ["diff", "--stat", "--", "src/"], { cwd: workdir, encoding: "utf8" });
  const match = result.stdout.match(/(\d+) insertion/);
  return match ? Number(match[1]) : 0;
}

function runOracle(workdir) {
  const result = spawnSync("npx", ["vitest", "run", "--reporter=verbose"], {
    cwd: workdir,
    encoding: "utf8",
    timeout: ORACLE_TIMEOUT_MS,
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return {
    pass: result.status === 0,
    output: (result.stdout || "") + (result.stderr || ""),
  };
}

// ---------------------------------------------------------------------------
// Pi runner
// ---------------------------------------------------------------------------

function extractAssistantText(message) {
  if (!message?.content) return "";
  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text || "")
    .join("");
}

function parsePiJson(stdout) {
  let text = "";
  let usage = null;
  for (const line of String(stdout).split("\n")) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === "turn_end" || event.type === "agent_end") {
      const msg = event.message || event.messages?.at(-1);
      if (msg?.role === "assistant") {
        text = extractAssistantText(msg) || text;
        if (msg.usage) usage = msg.usage;
      }
    }
    if (event.type === "message_end" && event.message?.role === "assistant") {
      text = extractAssistantText(event.message) || text;
      if (event.message.usage) usage = event.message.usage;
    }
  }
  return { text, usage };
}

function runPiSession({ piCwd, model, systemPrompt, userPrompt, workdir }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-sys-"));
  const sysFile = path.join(tmpDir, "system.txt");
  fs.writeFileSync(sysFile, systemPrompt || "", "utf8");

  const args = [
    "-p",
    "--model", model,
    "--no-skills",
    "--no-context-files",
    "--no-prompt-templates",
    "--thinking", "off",
    "--mode", "json",
    "--no-session",
    "--append-system-prompt", sysFile,
    userPrompt,
  ];

  const started = Date.now();
  let killed = false;

  const child = spawn(PI, args, {
    cwd: workdir,   // agent works inside the fixture copy
    encoding: "utf8",
    env: { ...process.env, CAVEMAN_DEFAULT_MODE: "off", PONYTAIL_DEFAULT_MODE: "off" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => { stdout += d; });
  child.stderr.on("data", (d) => { stderr += d; });

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000);
    }, TASK_TIMEOUT_MS);

    child.on("exit", () => {
      clearTimeout(timer);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      const elapsedSec = (Date.now() - started) / 1000;
      if (killed) {
        resolve({ text: "", usage: null, elapsedSec, reason: "timeout" });
        return;
      }
      if (child.exitCode !== 0) {
        const err = (stderr || stdout || "pi failed").trim().split("\n").pop();
        resolve({ text: "", usage: null, elapsedSec, reason: err || "pi exit" });
        return;
      }
      const parsed = parsePiJson(stdout);
      resolve({ ...parsed, elapsedSec, reason: null });
    });
  });
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function totalTokens(usage) {
  if (!usage) return 0;
  if (usage.totalTokens) return usage.totalTokens;
  return (usage.input || 0) + (usage.output || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function pctChange(base, value) {
  if (!base) return "n/a";
  const pct = (1 - value / base) * 100;
  const sign = pct >= 0 ? "less" : "more";
  return `${Math.abs(pct).toFixed(0)}% ${sign}`;
}

// ---------------------------------------------------------------------------
// Selftest
// ---------------------------------------------------------------------------

async function selftest() {
  console.log("Running selftest...");
  const cases = [
    { name: "good (should PASS oracle)", variant: "good", expectPass: true },
    { name: "bad (should FAIL oracle)", variant: "bad", expectPass: false },
  ];

  let allOk = true;
  for (const tc of cases) {
    process.stdout.write(`  ${tc.name} ... `);
    const workdir = createWorkdir();
    try {
      overlayReference(workdir, tc.variant);
      installDeps(workdir);
      overlayOracle(workdir);
      const result = runOracle(workdir);
      const ok = result.pass === tc.expectPass;
      console.log(ok ? "OK" : `FAIL (pass=${result.pass}, expected=${tc.expectPass})`);
      if (!ok) {
        allOk = false;
        console.error(`    oracle output:\n${result.output.split("\n").slice(0, 30).join("\n")}`);
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      allOk = false;
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  }
  console.log(allOk ? "\nSelftest PASSED" : "\nSelftest FAILED");
  return allOk;
}

// ---------------------------------------------------------------------------
// Main benchmark
// ---------------------------------------------------------------------------

async function bench(opts) {
  if (!fs.existsSync(PI)) {
    throw new Error(`pi binary not found at ${PI}. Set PI_BIN env or install pi.`);
  }

  const arms = buildArms();
  const armNames = opts.arms.filter((a) => {
    if (arms[a]) return true;
    console.error(`Unknown arm: ${a}. Valid: ${Object.keys(arms).join(", ")}`);
    return false;
  });
  if (!armNames.length) process.exit(1);

  const results = [];
  const totalCells = armNames.length * opts.repeat;
  let done = 0;

  for (let rep = 0; rep < opts.repeat; rep++) {
    for (const arm of armNames) {
      done++;
      process.stdout.write(`[${done}/${totalCells}] rep${rep + 1} ${arm} ... `);

      // 1. Create workdir
      const workdir = createWorkdir();

      try {
        // 2. Install deps before agent session
        installDeps(workdir);

        // 3. Run pi session (agent edits files in workdir)
        const { text, usage, elapsedSec, reason } = await runPiSession({
          piCwd: opts.piCwd,
          model: opts.model,
          systemPrompt: arms[arm]().systemPrompt,
          userPrompt: arms[arm]().userPrompt,
          workdir,
        });

        if (reason) {
          // pi failed or timed out
          results.push({ arm, task: "url-shortener", rep, pass: false, totalTokens: totalTokens(usage), srcLoc: 0, elapsedSec, reason });
          console.log(`pi error: ${reason} (${elapsedSec.toFixed(1)}s)`);
          continue;
        }

        // 4. Overlay oracle tests (agent never saw these)
        overlayOracle(workdir);

        // 5. Run oracle
        const oracle = runOracle(workdir);

        // 6. Count src LOC
        const srcLoc = countSrcLoc(workdir);

        const tokens = totalTokens(usage);
        results.push({
          arm,
          task: "url-shortener",
          rep,
          pass: oracle.pass,
          totalTokens: tokens,
          srcLoc,
          elapsedSec,
          reason: oracle.pass ? null : "oracle fail",
        });

        console.log(
          `${oracle.pass ? "PASS" : "FAIL"}  ${tokens} tok  ${srcLoc} loc  ${elapsedSec.toFixed(1)}s`,
        );
      } catch (e) {
        results.push({ arm, task: "url-shortener", rep, pass: false, totalTokens: 0, srcLoc: 0, elapsedSec: 0, reason: e.message });
        console.log(`ERROR: ${e.message}`);
      } finally {
        if (!opts.keepFailed || results.at(-1)?.pass) {
          fs.rmSync(workdir, { recursive: true, force: true });
        }
      }
    }
  }

  return results;
}

function printSummary(results, opts) {
  const armNames = [...new Set(results.map((r) => r.arm))];
  const col = 12;

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  PI REAL-TASK BENCHMARK  model=${opts.model}  n=${opts.repeat}`);
  console.log(`${"=".repeat(64)}\n`);

  // Pass rate
  console.log("Pass rate");
  console.log(`${"arm".padEnd(22)}${"pass/total".padStart(col)}${"pass%".padStart(col)}`);
  console.log("-".repeat(22 + col * 2));
  for (const arm of armNames) {
    const cells = results.filter((r) => r.arm === arm);
    const passed = cells.filter((r) => r.pass).length;
    const pct = ((passed / cells.length) * 100).toFixed(0);
    console.log(`${arm.padEnd(22)}${(`${passed}/${cells.length}`).padStart(col)}${(`${pct}%`).padStart(col)}`);
  }

  // Tokens (median among passing only)
  console.log("\nTotal tokens (median, passing cells only)");
  console.log(`${"arm".padEnd(22)}${"median tok".padStart(col)}${"vs baseline".padStart(col + 4)}`);
  console.log("-".repeat(22 + col * 2 + 4));

  const baseTokens = results.filter((r) => r.arm === "baseline" && r.pass).map((r) => r.totalTokens);
  const baseTokenMedian = median(baseTokens);

  for (const arm of armNames) {
    const armTokens = results.filter((r) => r.arm === arm && r.pass).map((r) => r.totalTokens);
    const armMedian = median(armTokens);
    const vs = arm === "baseline" ? "—" : pctChange(baseTokenMedian, armMedian);
    console.log(`${arm.padEnd(22)}${String(Math.round(armMedian)).padStart(col)}${vs.padStart(col + 4)}`);
  }

  // Source LOC (median among passing)
  console.log("\nSource LOC (median, passing cells only)");
  console.log(`${"arm".padEnd(22)}${"median loc".padStart(col)}${"vs baseline".padStart(col + 4)}`);
  console.log("-".repeat(22 + col * 2 + 4));

  const baseLocs = results.filter((r) => r.arm === "baseline" && r.pass).map((r) => r.srcLoc);
  const baseLocMedian = median(baseLocs);

  for (const arm of armNames) {
    const armLocs = results.filter((r) => r.arm === arm && r.pass).map((r) => r.srcLoc);
    const armMedian = median(armLocs);
    const vs = arm === "baseline" ? "—" : pctChange(baseLocMedian, armMedian);
    console.log(`${arm.padEnd(22)}${String(Math.round(armMedian)).padStart(col)}${vs.padStart(col + 4)}`);
  }

  // Seconds (median, all cells)
  console.log("\nSeconds (median, all cells)");
  console.log(`${"arm".padEnd(22)}${"median sec".padStart(col)}${"vs baseline".padStart(col + 4)}`);
  console.log("-".repeat(22 + col * 2 + 4));

  const baseSecs = results.filter((r) => r.arm === "baseline").map((r) => r.elapsedSec);
  const baseSecMedian = median(baseSecs);

  for (const arm of armNames) {
    const armSecs = results.filter((r) => r.arm === arm).map((r) => r.elapsedSec);
    const armMedian = median(armSecs);
    const vs = arm === "baseline" ? "—" : pctChange(baseSecMedian, armMedian);
    console.log(`${arm.padEnd(22)}${armMedian.toFixed(1).padStart(col)}${vs.padStart(col + 4)}`);
  }

  // Decision
  console.log(`\n${"=".repeat(64)}`);
  console.log("  Decision (per spec)");
  console.log(`${"=".repeat(64)}`);

  const baselinePassPct = (() => {
    const cells = results.filter((r) => r.arm === "baseline");
    return cells.length ? cells.filter((r) => r.pass).length / cells.length : 0;
  })();

  for (const arm of armNames) {
    if (arm === "baseline") continue;
    const armCells = results.filter((r) => r.arm === arm);
    const armPassPct = armCells.length ? armCells.filter((r) => r.pass).length / armCells.length : 0;
    const armTokens = armCells.filter((r) => r.pass).map((r) => r.totalTokens);
    const armTokenMedian = median(armTokens);

    let verdict;
    if (armPassPct < baselinePassPct) {
      verdict = "WORSE (pass% dropped)";
    } else if (armPassPct >= baselinePassPct && armTokenMedian < baseTokenMedian) {
      verdict = "HELPS (pass% ok, tokens down)";
    } else {
      verdict = "NO GAIN (pass% ok, tokens same or up)";
    }
    console.log(`  ${arm.padEnd(20)} ${verdict}`);
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);

  if (opts.selftest) {
    const ok = await selftest();
    process.exit(ok ? 0 : 1);
  }

  console.log(`Model: ${opts.model}`);
  console.log(`Arms: ${opts.arms.join(", ")}`);
  console.log(`Repeat: ${opts.repeat}\n`);

  const results = await bench(opts);

  printSummary(results, opts);

  // JSON output
  const outFile = path.join(ROOT, "benchmark-pi-real-results.json");
  const json = { model: opts.model, repeat: opts.repeat, arms: opts.arms, results };
  fs.writeFileSync(outFile, JSON.stringify(json, null, 2), "utf8");
  console.log(`\nResults saved to ${outFile}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
