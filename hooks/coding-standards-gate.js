#!/usr/bin/env node
// Claude Code hook that puts a disclosed ~/.claude payload in context before the first edit
// it governs, once per session and per subagent in it: CODING_STANDARDS.md for any edit,
// PROMPT_ENGINEERING.md for an edit to a prompt file. Fails open: a hook error must never
// block an edit.
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

const PROMPT_FILE = /(^|[\\/])(CLAUDE(\.local)?|AGENTS|GLOBAL|SKILL)\.md$|[\\/]rules[\\/][^\\/]+\.md$/i;

// One edit injects at most one payload: a hook's additionalContext is capped at 10,000
// characters and the two files together exceed it. Rows run in order, so the first edit to a
// prompt file gets PROMPT_ENGINEERING.md and CODING_STANDARDS.md waits for the next edit.
const PAYLOADS = [
  {
    id: 'prompting',
    file: 'PROMPT_ENGINEERING.md',
    phrase: 'governs this prompt-file edit and every later one in this session',
    governs: (filePath) => PROMPT_FILE.test(filePath),
  },
  { id: 'standards', file: 'CODING_STANDARDS.md', phrase: INJECTION_PHRASE, governs: () => true },
];

const safeName = (value) => String(value).replace(/[^\w-]/g, '');

function inject(sessionDir, agentId, filePath) {
  for (const payload of PAYLOADS) {
    if (!payload.governs(filePath)) continue;
    const payloadPath = path.join(os.homedir(), '.claude', payload.file);
    let text;
    try {
      text = fs.readFileSync(payloadPath, 'utf8');
      fs.mkdirSync(sessionDir, { recursive: true });
      // 'wx' creates the marker atomically, so two parallel edits cannot both inject.
      const marker = `${safeName(agentId || 'main')}--${payload.id}`;
      fs.writeFileSync(path.join(sessionDir, marker), '', { flag: 'wx' });
    } catch {
      continue;
    }
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `${payloadPath} ${payload.phrase}:\n\n${text}`,
      },
    }));
    return;
  }
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
  const toolInput = input.tool_input || {};
  inject(sessionDir, input.agent_id, String(toolInput.file_path || toolInput.notebook_path || ''));
});
