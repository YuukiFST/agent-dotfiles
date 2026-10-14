#!/usr/bin/env node
// Claude Code hook that puts ~/.claude/CODING_STANDARDS.md in context before the first edit
// of each session and of each subagent in it. Fails open: a hook error must never block an edit.
//
//   PreToolUse, matcher Edit|Write|MultiEdit|NotebookEdit:  node coding-standards-gate.js
//   SessionStart, matcher compact|clear:                    node coding-standards-gate.js --reset
//
// --reset forgets the session's injections, because compaction summarises the text away
// while the session id stays the same.

const fs = require('fs');
const path = require('path');
const os = require('os');

// scripts/rules-audit.py counts sessions by this phrase; change both together.
const INJECTION_PHRASE = 'governs this edit and every later one in this session';
const MARKER_ROOT = path.join(os.tmpdir(), 'claude-coding-standards');

const safeName = (value) => String(value).replace(/[^\w-]/g, '');

function inject(sessionDir, agentId) {
  const standardsPath = path.join(os.homedir(), '.claude', 'CODING_STANDARDS.md');
  let standards;
  try {
    standards = fs.readFileSync(standardsPath, 'utf8');
    fs.mkdirSync(sessionDir, { recursive: true });
    // 'wx' creates the marker atomically, so two parallel edits cannot both inject.
    fs.writeFileSync(path.join(sessionDir, safeName(agentId || 'main')), '', { flag: 'wx' });
  } catch {
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `${standardsPath} ${INJECTION_PHRASE}:\n\n${standards}`,
    },
  }));
}

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }
  if (!input.session_id) return;

  const sessionDir = path.join(MARKER_ROOT, safeName(input.session_id));
  if (process.argv.includes('--reset')) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    return;
  }
  inject(sessionDir, input.agent_id);
});
