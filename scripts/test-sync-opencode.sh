#!/usr/bin/env bash
# E2E test for the OpenCode side of a sync: generated skill command wrappers go so each skill's
# native /name command shows, and set-opencode-mcp.mjs adds mcp.fff to a commented opencode.jsonc
# without losing the user's other keys.
# Run: bash scripts/test-sync-opencode.sh
set -uo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

home="$WORK/home"
export XDG_CONFIG_HOME="$home/.config"
oc="$XDG_CONFIG_HOME/opencode"
mkdir -p "$oc/commands"

# A wrapper the old generator wrote, one for a skill deleted since, and a hand-written command.
for skill in ui-polish brainstorming; do
  printf -- '---\ndescription: "old"\n---\n\n<!-- generated:opencode-skill-command v1 -->\nActivate the skill `%s` now.\n' "$skill" > "$oc/commands/$skill.md"
done
printf -- '---\ndescription: "mine"\n---\nDeploy.\n' > "$oc/commands/deploy.md"

# Comments, a trailing comma, // inside a string and another MCP server the user owns.
cat > "$oc/opencode.jsonc" <<'EOF'
{
  // provider set by hand on this machine
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5", /* keep */
  "mcp": {
    "other": { "type": "local", "command": ["other-mcp", "--flag"], "enabled": true },
  },
}
EOF
cp "$oc/opencode.jsonc" "$WORK/original.jsonc"

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}
config_has() { # config_has <file> <js expression over c>
  node -e 'const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.exit(eval(process.argv[2]) ? 0 : 1)' "$1" "$2"
}

expect "sync exits 0" env HOME="$home" bash "$SCRIPTS/sync-config.sh" opencode
expect "generated wrapper for a live skill removed" test ! -e "$oc/commands/ui-polish.md"
expect "generated wrapper for a deleted skill removed" test ! -e "$oc/commands/brainstorming.md"
expect "hand-written command kept" test -e "$oc/commands/deploy.md"

for run in 1 2; do
  expect "set-opencode-mcp run $run exits 0" node "$SCRIPTS/set-opencode-mcp.mjs" fff fff-mcp-test
done
expect "edits the existing opencode.jsonc, creates no opencode.json" test ! -e "$oc/opencode.json"
expect "mcp.fff points at the binary" config_has "$oc/opencode.jsonc" \
  'JSON.stringify(c.mcp.fff) === JSON.stringify({ type: "local", command: ["fff-mcp-test"], enabled: true })'
expect "the user's MCP server and model survive" config_has "$oc/opencode.jsonc" \
  'c.mcp.other.command[1] === "--flag" && c.model === "anthropic/claude-sonnet-4-5" && c.$schema.startsWith("https://")'
expect "original kept as .bak" cmp -s "$WORK/original.jsonc" "$oc/opencode.jsonc.bak"

rm -rf "$oc"
expect "no config yet: run exits 0" node "$SCRIPTS/set-opencode-mcp.mjs" fff fff-mcp-test
expect "no config yet: opencode.json created with mcp.fff" config_has "$oc/opencode.json" 'c.mcp.fff.command[0] === "fff-mcp-test"'
expect "no config yet: no .bak" test ! -e "$oc/opencode.json.bak"

[ "$fail" -eq 0 ]
