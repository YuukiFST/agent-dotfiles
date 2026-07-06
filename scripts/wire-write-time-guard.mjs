#!/usr/bin/env node
// Idempotently wire the write-time-guard PostToolUse hook into a Claude Code
// settings.json. Called by setup-claude.{sh,ps1} — a user-level hook needs an
// ABSOLUTE command path (no documented config-dir placeholder; `~`/`$HOME` do not
// expand cross-platform), so the path is computed per-machine at install and merged
// in here. Matches the convention already used by the caveman plugin's hooks:
// `command: node "<abs>"`.
//
// Usage: node wire-write-time-guard.mjs <settings.json path> <hook.js abs path>
// Re-running replaces any prior write-time-guard entry (keeps the path fresh), so it
// is safe to run on every setup.

import { readFileSync, writeFileSync, existsSync } from "node:fs"

const [settingsPath, hookPath] = process.argv.slice(2)
if (!settingsPath || !hookPath) {
  console.error("usage: wire-write-time-guard.mjs <settings.json> <hook.js abs path>")
  process.exit(1)
}

let settings = {}
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"))
  } catch (err) {
    // A malformed settings.json is the user's, not ours to clobber — fail loud.
    console.error(`wire-write-time-guard: ${settingsPath} is not valid JSON: ${err.message}`)
    process.exit(1)
  }
}

settings.hooks ??= {}
const postToolUse = Array.isArray(settings.hooks.PostToolUse) ? settings.hooks.PostToolUse : []

// Drop any prior write-time-guard entry (idempotent + path refresh across machines).
const isOurs = (entry) =>
  Array.isArray(entry?.hooks) &&
  entry.hooks.some((h) => typeof h?.command === "string" && h.command.includes("write-time-guard"))

const kept = postToolUse.filter((entry) => !isOurs(entry))

kept.push({
  matcher: "Edit|Write",
  hooks: [{ type: "command", command: `node "${hookPath}"`, timeout: 10 }],
})

settings.hooks.PostToolUse = kept
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n")
console.log(`wire-write-time-guard: PostToolUse hook -> ${hookPath}`)
