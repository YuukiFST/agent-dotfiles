#!/usr/bin/env node
'use strict';
/**
 * PostToolUse Hook (Edit|Write) — quality checklist AT WRITE TIME.
 *
 * The problem it solves: the knowledge inside the code-quality skills (improve,
 * thermo-nuclear-code-quality-review, security-review, security-bounty-hunter,
 * codebase-design, diagnosing-bugs, test/perf reviewers) only enters context when a
 * skill is invoked — AFTER the code is written, at review time. This hook moves the
 * distilled essence of those skills to the moment of editing: when a file in a known
 * area is touched (backend / frontend / test / schema / infra), it injects that
 * area's digest as `additionalContext`, so the agent writes it right the first time.
 *
 * Stack-agnostic by design (this is a GLOBAL config applied to every project): the
 * digests are the cross-cutting rules that hold in any language/stack, distilled from
 * the common themes across the skills — not tied to one framework. A project that
 * wants stack-specific digests (e.g. tRPC/Prisma escaping rules) keeps its own copy
 * of this hook in its repo with tailored content.
 *
 * Anti-noise: each digest injects AT MOST once per session (state in a temp file keyed
 * by session_id). Robust by design: never throws, always exits 0 — a PostToolUse hook
 * that fails must not disrupt editing.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIGESTS = {
  backend: [
    '[write-time · backend (server/api/service/handler/db logic) — distilled from security-review + thermo-nuclear + codebase-design]',
    '• Authz at every entry point; before acting on a record by id, verify the caller owns/may-access it (IDOR); never trust identity/role from client input.',
    '• Validate all external input at the trust boundary; on writes use an explicit field whitelist (no mass-assignment of the raw input object).',
    '• Errors never swallowed: no empty catch; propagate typed, log with context before any 5xx; secrets/PII never in logs or error messages.',
    '• Related writes in one transaction (all-or-nothing); side effects (audit/notify/cleanup) after commit, best-effort but always logged on failure.',
    '• Reads: select only the fields used; paginate/limit growing lists; count in the DB, not in memory; no query-in-a-loop (batch to kill N+1); filter soft-deletes.',
    '• No hardcoded secrets (env vars); constant-time compare for secret/token equality.',
    '• Design: small interface + deep implementation; one responsibility per unit; inject dependencies (don\'t construct I/O inline) so it stays testable.',
  ].join('\n'),

  frontend: [
    '[write-time · frontend (UI component/page) — distilled from the design + review skills]',
    '• Reuse the existing design system / shared components before creating; never duplicate a primitive that already exists.',
    '• Use design tokens, not hardcoded colors (dark-mode safe); skip custom CSS when the system/native platform already covers it.',
    '• Every async view has loading + empty + error states; sanitize any user-provided HTML (XSS) — no raw innerHTML on untrusted input.',
    '• Accessibility basics (labels, roles, focus order, adequate touch targets); mobile-first / responsive.',
    '• Verify layout in the real running app for any positioning change — type-check/lint do not catch overflow, overlap, or collapsed scroll.',
  ].join('\n'),

  test: [
    '[write-time · test — distilled from test-reviewer + diagnosing-bugs]',
    '• Test behavior through the public interface, not implementation details — it must survive a refactor.',
    '• Mock only external I/O with named fakes; NEVER mock the unit under test (that is a tautology = false green).',
    '• Cover the error/negative path and boundary values (null, empty, 0, max), not just the happy path.',
    '• Precise assertions (exact expected values, not just truthy); deterministic (no random, no wall-clock, no shared state).',
    '• Fixing a bug → write the regression test that reproduces it FIRST (red before the fix, green after).',
  ].join('\n'),

  schema: [
    '[write-time · db schema / migration — distilled from the schema-design rules]',
    '• Every table: stable primary key + created/updated timestamps; soft-delete flag only if needed, and then filtered in every read.',
    '• Index every foreign key and every column used to filter/sort; explicit on-delete behavior; unique only on non-nullable natural keys.',
    '• No stored calculable/derived fields, no redundant booleans, no wide tables (split by context/concern).',
    '• Right types (decimal for money, never float; string for phone/zip/codes).',
    '• Migrations additive-first (expand → migrate → contract) so a code rollback stays safe.',
  ].join('\n'),

  infra: [
    '[write-time · infra (shell/docker/CI/nginx/terraform) — distilled from devops review]',
    '• Bash: `set -euo pipefail`; quote every variable expansion; no word-splitting on unquoted vars.',
    '• No secrets in the file or in echoed output; least privilege for every credential/role.',
    '• Idempotent (safe to re-run); a real failure must fail the step — beware `|| true` and heredocs consumed by a nested command hiding a non-zero exit.',
    '• A backup/rollback path exists before any destructive op; a health check runs after deploy.',
  ].join('\n'),
};

/** Classify the edited file into a digest area (or null). Order matters. */
function areaFor(filePath) {
  const p = String(filePath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (!p) return null;

  // test — before everything (a *.test.tsx is a test, not frontend)
  if (
    /\.(test|spec)\.[jt]sx?$/.test(p) ||
    /(^|\/)test_[^/]*\.py$/.test(p) ||
    /_test\.(go|py|rb|java)$/.test(p) ||
    /(^|\/)(tests?|__tests__|spec)\//.test(p)
  ) {
    return 'test';
  }

  // infra
  if (
    /\.sh$/.test(p) ||
    /(^|\/)dockerfile$/.test(p) ||
    /docker-compose[^/]*\.ya?ml$/.test(p) ||
    /\.tf$/.test(p) ||
    /nginx[^/]*\.conf$/.test(p) ||
    /\.github\/workflows\/[^/]*\.ya?ml$/.test(p) ||
    /(^|\/)(deploy|setup)[^/]*\.(sh|ps1)$/.test(p)
  ) {
    return 'infra';
  }

  // schema / migration
  if (
    /schema\.prisma$/.test(p) ||
    /\.sql$/.test(p) ||
    /(^|\/)migrations?\//.test(p) ||
    /(^|\/)models\.py$/.test(p) ||
    /(^|\/)schema\.rb$/.test(p)
  ) {
    return 'schema';
  }

  // frontend — UI component extensions, or component/page dirs
  if (
    /\.(tsx|jsx|vue|svelte)$/.test(p) ||
    /(^|\/)(components|pages|views)\/[^/]*\.[jt]s$/.test(p)
  ) {
    return 'frontend';
  }

  // backend — server-ish dirs, or a server language file
  if (
    /(^|\/)(server|api|services?|handlers?|controllers?|routes?|backend|repository|repositories)\//.test(p) ||
    /\.(go|rs|rb|py|java|php|cs)$/.test(p)
  ) {
    return 'backend';
  }

  return null;
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

try {
  const payload = JSON.parse(readStdin() || '{}');
  const area = areaFor(payload?.tool_input?.file_path);
  if (area) {
    // Dedupe per session: 1 injection per area. Temp-file state — an I/O failure here
    // degrades to "inject again", never to "break the hook".
    const sessionId = String(payload?.session_id || 'nosession').replace(/[^\w-]/g, '');
    const stateFile = path.join(os.tmpdir(), `write-time-guard-${sessionId}.json`);
    let seen = [];
    try {
      seen = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (!Array.isArray(seen)) seen = [];
    } catch {
      seen = [];
    }
    if (!seen.includes(area)) {
      try {
        fs.writeFileSync(stateFile, JSON.stringify([...seen, area]));
      } catch {
        // best-effort
      }
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PostToolUse',
            additionalContext: DIGESTS[area],
          },
        }),
      );
    }
  }
} catch {
  // best-effort: never disrupt the edit.
}
process.exit(0);
