#!/usr/bin/env node
// A/B the repo's bin/agent-cli: run each task as a headless Claude Code session in a worktree
// at the base ref (no CLI) and one at HEAD (with it), and print mean turns, tokens, wall time
// and cost per task. Each session loads only its own worktree's AGENTS.md / CLAUDE.md, which a
// subagent of the current session would not (it inherits this session's context).
//
// Run from the repo, with the CLI committed:
//   node measure.mjs --base <ref> --tasks <file> [--reps 2] [--model sonnet] [--tools "Bash Read Grep Glob"]
// <file>: one task per line, "name: brief"; blank lines and lines starting with # are skipped.
// Prints the table and the dir holding every answer (<arm>-<task>-<rep>.md) for the correctness
// check; that dir is yours to delete. Worktrees are removed before exit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function die(msg) {
  console.error(msg);
  process.exit(2);
}

const base = arg('base') || die('missing --base <ref> (the commit before bin/agent-cli)');
const tasksFile = arg('tasks') || die('missing --tasks <file>');
const reps = Number(arg('reps', '2'));
const model = arg('model', 'sonnet');
const tools = arg('tools', 'Bash Read Grep Glob').split(/\s+/).filter(Boolean);
// The command line goes through a shell on Windows (claude is a .cmd shim), so only plain tokens.
for (const t of [model, ...tools]) if (!/^[\w.:()*-]+$/.test(t)) die(`unsafe token for the command line: ${t}`);
if (!Number.isInteger(reps) || reps < 1) die('--reps must be a positive integer');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
if (git('status', '--porcelain', '--untracked-files=no')) die('commit first: the HEAD worktree holds only committed files');
const baseSha = git('rev-parse', '--verify', `${base}^{commit}`);
const headSha = git('rev-parse', 'HEAD');
if (baseSha === headSha) die('--base resolves to HEAD; pick the commit before bin/agent-cli');

const tasks = fs
  .readFileSync(tasksFile, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => {
    const m = l.match(/^([\w-]+):\s*(.+)$/);
    if (!m) die(`bad task line (want "name: brief"): ${l}`);
    return { name: m[1], brief: m[2] };
  });
if (!tasks.length) die(`no tasks in ${tasksFile}`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-measure-'));
const answers = path.join(work, 'answers');
fs.mkdirSync(answers);
const arms = { base: path.join(work, 'base'), cli: path.join(work, 'cli') };
execFileSync('git', ['-C', root, 'worktree', 'add', '-q', '--detach', arms.base, baseSha]);
execFileSync('git', ['-C', root, 'worktree', 'add', '-q', '--detach', arms.cli, headSha]);

const cmd = ['claude', '-p', '--model', model, '--output-format', 'json', '--permission-mode', 'dontAsk',
  '--no-session-persistence', '--allowedTools', ...tools].join(' ');

function runSession(arm, task, rep) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd: arms[arm], shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', () => {
      let o = null;
      try { o = JSON.parse(out); } catch { /* reported below as a failed run */ }
      const u = (o && o.usage) || {};
      const run = o && {
        turns: o.num_turns,
        tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0),
        seconds: o.duration_ms / 1000,
        usd: o.total_cost_usd || 0,
        error: Boolean(o.is_error),
      };
      fs.writeFileSync(path.join(answers, `${arm}-${task.name}-${rep}.md`), o ? String(o.result) : `NO JSON OUTPUT\n${out}`);
      resolve({ arm, task: task.name, run });
    });
    child.stdin.end(`${task.brief}\nAnswer only; do not edit files, commit, push, or run a sync.`);
  });
}

const jobs = [];
for (const task of tasks) for (const arm of Object.keys(arms)) for (let r = 1; r <= reps; r++) jobs.push(runSession(arm, task, r));
let results;
try {
  results = await Promise.all(jobs);
} finally {
  for (const dir of Object.values(arms)) execFileSync('git', ['-C', root, 'worktree', 'remove', '--force', dir]);
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (a, b) => (a ? `${b <= a ? '-' : '+'}${Math.round((Math.abs(b - a) / a) * 100)}%` : 'n/a');
const k = (n) => `${Math.round(n / 1000)}k`;
console.log(`model ${model}, ${reps} run(s) per arm, base ${baseSha.slice(0, 7)} vs HEAD ${headSha.slice(0, 7)}\n`);
console.log('| Task | Turns | Tokens | Time | Cost (USD) | Failed runs |');
console.log('|---|---|---|---|---|---|');
for (const task of tasks) {
  const arm = (a) => results.filter((r) => r.task === task.name && r.arm === a && r.run && !r.run.error).map((r) => r.run);
  const b = arm('base');
  const c = arm('cli');
  const failed = results.filter((r) => r.task === task.name && (!r.run || r.run.error)).length;
  if (!b.length || !c.length) { console.log(`| ${task.name} | no successful run in one arm | | | | ${failed} |`); continue; }
  const m = (xs, f) => mean(xs.map(f));
  const row = (f, fmt) => `${fmt(m(b, f))} → ${fmt(m(c, f))} (${pct(m(b, f), m(c, f))})`;
  console.log(`| ${task.name} | ${row((x) => x.turns, (v) => v.toFixed(1))} | ${row((x) => x.tokens, k)} | ${row((x) => x.seconds, (v) => `${Math.round(v)}s`)} | ${row((x) => x.usd, (v) => `$${v.toFixed(3)}`)} | ${failed} |`);
}
console.log(`\nanswers: ${answers}`);
