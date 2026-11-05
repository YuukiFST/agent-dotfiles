// Regression: Herdr showed a session as Done while its background shell or agent still ran.
// Reported by the user with the status "1 shell · ← 1 agent" on screen.
// Drives hooks/statusline.ps1 as Claude Code does (JSON on stdin, a transcript on disk) and
// checks the `background` count the Herdr mod reads from state/ctx/<terminal>.json.
//   node scripts/test-statusline-regression-background-tasks.cjs [statusline.ps1]
const { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("fs");
const { execFileSync } = require("child_process");
const os = require("os");
const path = require("path");

const script = process.argv[2] ?? path.join(__dirname, "..", "hooks", "statusline.ps1");
const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-background-"));
const transcript = path.join(dir, "transcript.jsonl");
writeFileSync(transcript, "");

const userLine = (content) => JSON.stringify({ type: "user", isSidechain: false, message: { role: "user", content } }) + "\n";
const toolResult = (content) => userLine([{ type: "tool_result", tool_use_id: "x", content }]);
const statusInput = JSON.stringify({
  transcript_path: transcript,
  context_window: { total_input_tokens: 1000, total_output_tokens: 10, context_window_size: 200000 },
  model: { display_name: "test" },
  cost: { total_cost_usd: 0 },
});

let failures = 0;
function expectBackground(label, line, expected) {
  appendFileSync(transcript, line);
  execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    input: statusInput,
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir, HC_TERMINAL_ID: "ttest" },
  });
  const state = readFileSync(path.join(dir, "state", "ctx", "ttest.json"), "utf8").replace(/^﻿/, "");
  const actual = JSON.parse(state).background;
  if (actual !== expected) failures++;
  console.log(`${actual === expected ? "ok  " : "FAIL"} ${label}: ${actual}`);
}

try {
  expectBackground("background shell starts", toolResult("Command running in background with ID: b111. Output is being written to: x"), 1);
  expectBackground("timed-out command moves to background", toolResult("Command did not complete within its 120s timeout and was moved to the background (ID: b222). Output"), 2);
  expectBackground("async agent starts", toolResult([{ type: "text", text: "Async agent launched successfully.\nagentId: a333 (internal ID)" }]), 3);
  expectBackground("quoted start phrase is ignored", toolResult("grep found: Command running in background with ID: fake"), 3);
  expectBackground("quoted notification is ignored", userLine("see <task-notification><task-id>b111</task-id>"), 3);
  expectBackground("sub-agent transcript line is ignored", JSON.stringify({ type: "user", isSidechain: true, message: { content: [{ type: "tool_result", content: "Command running in background with ID: side" }] } }) + "\n", 3);
  expectBackground("task notification ends a task", userLine("<task-notification>\n<task-id>b111</task-id>\n<status>completed</status>"), 2);
  expectBackground("queued notification ends a task", JSON.stringify({ isSidechain: false, attachment: { type: "queued_command", prompt: "<task-notification>\n<task-id>a333</task-id>" } }) + "\n", 1);
  expectBackground("TaskStop ends a task", toolResult('{"message":"Successfully stopped task: b222 (cmd)"}'), 0);
  // Reported with the screenshot "Idle · 1 shell": a timed-out command that had printed output
  // puts that output before the notice, so only toolUseResult names the task reliably.
  const movedAfterOutput = JSON.parse(toolResult("summary: 12 steps\nCommand did not complete within its 600s timeout and was moved to the background (ID: b444). Output"));
  movedAfterOutput.toolUseResult = { stdout: "summary: 12 steps", backgroundTaskId: "b444", timedOutAfterMs: 600000 };
  expectBackground("timed-out command with earlier output moves to background", JSON.stringify(movedAfterOutput) + "\n", 1);
  expectBackground("its notification ends it", userLine("<task-notification>\n<task-id>b444</task-id>\n<status>completed</status>"), 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
