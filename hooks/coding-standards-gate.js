#!/usr/bin/env node
// PreToolUse hook on the edit tools: puts ~/.claude/CODING_STANDARDS.md in context once per
// session, before its first edit. CLAUDE.md's pointer alone loaded it in 12 of 59 editing
// sessions (#162). Fails open: a hook error must never block an edit.

const fs = require('fs');
const path = require('path');
const os = require('os');

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let sessionId;
  try {
    sessionId = JSON.parse(raw).session_id;
  } catch {
    return;
  }
  if (!sessionId) return;

  const marker = path.join(os.tmpdir(), 'claude-coding-standards', String(sessionId).replace(/[^\w-]/g, ''));
  if (fs.existsSync(marker)) return;

  const standardsPath = path.join(os.homedir(), '.claude', 'CODING_STANDARDS.md');
  let standards;
  try {
    standards = fs.readFileSync(standardsPath, 'utf8');
  } catch {
    return;
  }

  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, '');
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `${standardsPath} governs this edit and every later one in this session:\n\n${standards}`,
    },
  }));
});
