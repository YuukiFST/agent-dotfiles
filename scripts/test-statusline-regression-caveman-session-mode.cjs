// Regression: the status line showed the machine-wide caveman mode instead of this session's.
// Reported by the user: with .caveman-active=full and .caveman-sessions/abc.mode=ultra,
// hooks/statusline.ps1 rendered [CAVEMAN] while caveman-statusline.ps1 alone rendered [ULTRACAVE].
// Drives hooks/statusline.ps1 as Claude Code does (JSON on stdin) against a temporary
// CLAUDE_CONFIG_DIR holding the repo's caveman-statusline.ps1.
//   node scripts/test-statusline-regression-caveman-session-mode.cjs [statusline.ps1]
const { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("fs");
const { execFileSync } = require("child_process");
const os = require("os");
const path = require("path");

const hooks = path.join(__dirname, "..", "hooks");
const script = process.argv[2] ?? path.join(hooks, "statusline.ps1");
const dir = mkdtempSync(path.join(os.tmpdir(), "statusline-caveman-"));
mkdirSync(path.join(dir, "hooks"));
mkdirSync(path.join(dir, ".caveman-sessions"));
copyFileSync(path.join(hooks, "caveman-statusline.ps1"), path.join(dir, "hooks", "caveman-statusline.ps1"));
writeFileSync(path.join(dir, ".caveman-active"), "full");
writeFileSync(path.join(dir, ".caveman-sessions", "abc.mode"), "ultra");

let failures = 0;
function expectBadge(label, sessionId, expected) {
  const input = JSON.stringify({ session_id: sessionId, model: { display_name: "test" } });
  const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    input,
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
  }).toString();
  const actual = (out.match(/\[([A-Z:]+)\]/) ?? [, "none"])[1];
  if (actual !== expected) failures++;
  console.log(`${actual === expected ? "ok  " : "FAIL"} ${label}: ${actual}`);
}

try {
  expectBadge("session mode wins over the machine-wide flag", "abc", "ULTRACAVE");
  expectBadge("session without a mode file falls back to the machine-wide flag", "zzz", "CAVEMAN");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
