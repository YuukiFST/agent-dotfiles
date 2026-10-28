#!/usr/bin/env bash
# E2E test for the OpenCode side of a sync: generated skill command wrappers go so each skill's
# native /name command shows, and remove-opencode-mcp.mjs drops the retired mcp.fff from a commented
# opencode.jsonc without losing the user's other keys.
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

# Comments, a trailing comma, // inside a string, the retired fff entry and another MCP server the user owns.
cat > "$oc/opencode.jsonc" <<'EOF'
{
  // provider set by hand on this machine
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5", /* keep */
  "mcp": {
    "other": { "type": "local", "command": ["other-mcp", "--flag"], "enabled": true },
    "fff": { "type": "local", "command": ["fff-mcp"], "enabled": true },
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
  expect "remove-opencode-mcp run $run exits 0" node "$SCRIPTS/remove-opencode-mcp.mjs" fff
done
expect "edits the existing opencode.jsonc, creates no opencode.json" test ! -e "$oc/opencode.json"
expect "mcp.fff removed" config_has "$oc/opencode.jsonc" '!("fff" in c.mcp)'
expect "the user's MCP server and model survive" config_has "$oc/opencode.jsonc"   'c.mcp.other.command[1] === "--flag" && c.model === "anthropic/claude-sonnet-4-5" && c.$schema.startsWith("https://")'
expect "original kept as .bak" cmp -s "$WORK/original.jsonc" "$oc/opencode.jsonc.bak"

rm -rf "$oc"
expect "no config yet: run exits 0" node "$SCRIPTS/remove-opencode-mcp.mjs" fff
expect "no config yet: creates nothing" test ! -e "$oc/opencode.json"

[ "$fail" -eq 0 ]
