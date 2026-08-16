#!/usr/bin/env node
/**
 * Ponytail A/B benchmark via pi + any Cursor-backed model (no Anthropic API key).
 *
 * Arms:
 *   baseline          — no ponytail system prompt (your current pi default)
 *   ponytail-default  — full raw skills/ponytail/SKILL.md (plugin/skill file)
 *   ponytail-full     — pi extension injection (getPonytailInstructions('full'))
 *
 * Usage:
 *   ./setup.sh
 *   node benchmark-pi.js --model cursor/grok-4.5 --repeat 1
 *   node benchmark-pi.js --model cursor/composer-2-5 --arms baseline,ponytail-default,ponytail-full --repeat 3
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const VENDOR = path.join(ROOT, ".vendor", "ponytail");
const PI = process.env.PI_BIN || path.join(os.homedir(), ".pi/agent/node_modules/.bin/pi");
const PI_CWD = process.env.PI_CWD || path.join(os.homedir(), ".pi/agent");

const TASKS = [
  { id: "email", task: "Write me a Python function that validates email addresses." },
  {
    id: "debounce",
    task:
      "Write a reusable debounce function in vanilla JavaScript: debounce(fn, delay) returns a debounced version of fn that delays calling it until delay ms after the last call.",
  },
  { id: "csv", task: "Write Python code that reads sales.csv and sums the 'amount' column." },
  {
    id: "countdown",
    task: "Build me a countdown timer component in React that counts down from a given number of seconds.",
  },
  { id: "ratelimit", task: "Add rate limiting to my FastAPI endpoint so users can't spam it." },
];

const SYSTEM_SUFFIX =
  "\n\nReply with a single fenced code block containing the solution. No preamble, no alternatives, no tool use.";

function loadPonytailInstructions() {
  const mod = path.join(VENDOR, "hooks", "ponytail-instructions.js");
  if (!fs.existsSync(mod)) {
    throw new Error(`Missing ${mod}. Run: ${path.join(ROOT, "setup.sh")}`);
  }
  return require(mod);
}

function loadArms() {
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

  const wrap = (messages) => {
    const system = messages.find((m) => m.role === "system")?.content || "";
    const user = messages.find((m) => m.role === "user")?.content || "";
    return {
      systemPrompt: system ? `${system}${SYSTEM_SUFFIX}` : SYSTEM_SUFFIX.trim(),
      userPrompt: user,
    };
  };

  return {
    baseline: (task) => wrap(baseline({ vars: { task } })),
    "ponytail-default": (task) => wrap(ponytailArm({ vars: { task } })),
    "ponytail-full": (task) =>
      wrap([
        { role: "system", content: getPonytailInstructions("full") },
        { role: "user", content: task },
      ]),
  };
}

function parseArgs(argv) {
  const opts = {
    repeat: 1,
    model: "cursor/composer-2-5",
    piCwd: PI_CWD,
    arms: ["baseline", "ponytail-default", "ponytail-full"],
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repeat") opts.repeat = Number(argv[++i]);
    else if (a === "--model") opts.model = argv[++i];
    else if (a === "--pi-cwd") opts.piCwd = argv[++i];
    else if (a === "--arms") opts.arms = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node benchmark-pi.js [--repeat N] [--model cursor/MODEL] [--arms baseline,ponytail-default,ponytail-full]`);
      process.exit(0);
    }
  }
  if (!Number.isFinite(opts.repeat) || opts.repeat < 1) {
    throw new Error("--repeat must be a positive integer");
  }
  return opts;
}

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
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
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

function runPi({ piCwd, model, systemPrompt, userPrompt }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ponytail-pi-bench-"));
  const sysFile = path.join(tmpDir, "system.txt");
  fs.writeFileSync(sysFile, systemPrompt || "", "utf8");

  const args = [
    "-p",
    "--model",
    model,
    "--no-tools",
    "--no-skills",
    "--no-context-files",
    "--no-prompt-templates",
    "--thinking",
    "off",
    "--mode",
    "json",
    "--no-session",
    "--append-system-prompt",
    sysFile,
    userPrompt,
  ];

  const started = Date.now();
  const result = spawnSync(PI, args, {
    cwd: piCwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CAVEMAN_DEFAULT_MODE: "off",
      PONYTAIL_DEFAULT_MODE: "off",
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  const elapsedSec = (Date.now() - started) / 1000;

  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "pi failed").trim().split("\n").pop();
    throw new Error(err);
  }

  return { ...parsePiJson(result.stdout), elapsedSec };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return 0;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function score(output, task) {
  const loc = require("./loc.js")(output);
  const correct = require("./correctness.js")(output, { vars: { task } });
  return { loc: loc.score, correctPass: correct.pass };
}

function totalTokens(usage) {
  if (!usage) return 0;
  if (usage.totalTokens) return usage.totalTokens;
  return (usage.input || 0) + (usage.output || 0) + (usage.cacheRead || 0) + (usage.cacheWrite || 0);
}

function pctChange(base, value) {
  if (!base) return "n/a";
  const pct = (1 - value / base) * 100;
  const sign = pct >= 0 ? "less" : "more";
  return `${Math.abs(pct).toFixed(0)}% ${sign}`;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(PI)) {
    throw new Error(`pi binary not found at ${PI}. Set PI_BIN or install pi at ~/.pi/agent`);
  }

  const allArms = loadArms();
  const armNames = opts.arms.filter((a) => {
    if (allArms[a]) return true;
    console.error(`Unknown arm: ${a}. Valid: ${Object.keys(allArms).join(", ")}`);
    return false;
  });
  if (!armNames.length) process.exit(1);

  const results = {};
  for (const arm of armNames) {
    results[arm] = {};
    for (const { id } of TASKS) results[arm][id] = [];
  }

  const totalCells = armNames.length * TASKS.length * opts.repeat;
  let done = 0;

  for (let rep = 0; rep < opts.repeat; rep += 1) {
    for (const arm of armNames) {
      for (const { id, task } of TASKS) {
        done += 1;
        process.stdout.write(`[${done}/${totalCells}] rep${rep + 1} ${arm}/${id} ... `);

        const { systemPrompt, userPrompt } = allArms[arm](task);
        const { text, usage, elapsedSec } = runPi({
          piCwd: opts.piCwd,
          model: opts.model,
          systemPrompt,
          userPrompt,
        });
        const scored = score(text, task);
        const tokens = totalTokens(usage);

        results[arm][id].push({
          loc: scored.loc,
          correctPass: scored.correctPass,
          tokens,
          elapsedSec,
          response: text,
        });

        console.log(`${scored.loc} LOC  ${tokens} tok  ${elapsedSec.toFixed(1)}s  ok=${scored.correctPass ? 1 : 0}`);
      }
    }
  }

  const med = (arm, id, field) => median(results[arm][id].map((r) => r[field]));
  const ids = TASKS.map((t) => t.id);
  const col = 10;
  const header = `${"arm".padEnd(18)}${ids.map((id) => id.padStart(col)).join("")}${"TOTAL".padStart(col)}`;
  const sep = "-".repeat(header.length);

  console.log(`\n${"=".repeat(64)}`);
  console.log(`  PI PONYTAIL BENCHMARK  model=${opts.model}  n=${opts.repeat}  (median)`);
  console.log(`${"=".repeat(64)}`);

  console.log("\nCode LOC per task");
  console.log(header);
  console.log(sep);
  for (const arm of armNames) {
    const row = ids.map((id) => med(arm, id, "loc"));
    console.log(`${arm.padEnd(18)}${row.map((v) => String(Math.round(v)).padStart(col)).join("")}${String(Math.round(row.reduce((a, b) => a + b, 0))).padStart(col)}`);
  }

  console.log("\nTotal tokens per task");
  console.log(header);
  console.log(sep);
  for (const arm of armNames) {
    const row = ids.map((id) => med(arm, id, "tokens"));
    console.log(`${arm.padEnd(18)}${row.map((v) => String(Math.round(v)).padStart(col)).join("")}${String(Math.round(row.reduce((a, b) => a + b, 0))).padStart(col)}`);
  }

  console.log("\nSeconds per task");
  console.log(header);
  console.log(sep);
  for (const arm of armNames) {
    const row = ids.map((id) => med(arm, id, "elapsedSec"));
    console.log(`${arm.padEnd(18)}${row.map((v) => v.toFixed(1).padStart(col)).join("")}${row.reduce((a, b) => a + b, 0).toFixed(1).padStart(col)}`);
  }

  const baseLoc = ids.reduce((s, id) => s + med("baseline", id, "loc"), 0);
  const baseTok = ids.reduce((s, id) => s + med("baseline", id, "tokens"), 0);
  const baseTime = ids.reduce((s, id) => s + med("baseline", id, "elapsedSec"), 0);

  console.log(`\n${"=".repeat(64)}`);
  console.log("  vs baseline (median totals, 5 tasks)");
  console.log(`${"=".repeat(64)}`);
  for (const arm of armNames) {
    if (arm === "baseline") continue;
    const armLoc = ids.reduce((s, id) => s + med(arm, id, "loc"), 0);
    const armTok = ids.reduce((s, id) => s + med(arm, id, "tokens"), 0);
    const armTime = ids.reduce((s, id) => s + med(arm, id, "elapsedSec"), 0);
    console.log(
      `  ${arm.padEnd(16)} LOC ${armLoc} (${pctChange(baseLoc, armLoc)} vs baseline)  ` +
        `tokens ${armTok} (${pctChange(baseTok, armTok)} vs baseline)  ` +
        `time ${armTime.toFixed(1)}s (${pctChange(baseTime, armTime)} vs baseline)`,
    );
  }

  const outFile = path.join(ROOT, "benchmark-pi-results.json");
  fs.writeFileSync(
    outFile,
    JSON.stringify({ model: opts.model, repeat: opts.repeat, arms: armNames, results }, null, 2),
    "utf8",
  );
  console.log(`\nFull responses -> ${outFile}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
