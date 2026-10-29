#!/usr/bin/env bash
# E2E test for scripts/add-opencode-tui-plugin.mjs: OpenCode 2 loads the TUI half of a plugin
# (sidebar, palette) only from cli.json, so adding one must append to plugins[] once, keep every
# other key the machine owns, and refuse a shape it does not own instead of overwriting it.
# Run: bash scripts/test-add-opencode-tui-plugin.sh
set -uo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export XDG_CONFIG_HOME="$WORK/config"
cli="$XDG_CONFIG_HOME/opencode/cli.json"
pkg="@prevalentware/opencode-goal-plugin"

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}
expect_fail() { # expect_fail <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "FAILED: $what" >&2; fail=1; else echo "ok: $what"; fi
}
cli_has() { # cli_has <js expression over c>
  node -e 'const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); process.exit(eval(process.argv[2]) ? 0 : 1)' "$cli" "$1"
}

# A fresh machine has no cli.json; the script seeds one with the schema OpenCode 2 documents.
expect "absent cli.json: exits 0" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "absent cli.json: seeds the schema and the plugin" cli_has \
  'c.$schema === "https://opencode.ai/v2/cli.json" && c.plugins.length === 1 && c.plugins[0] === "@prevalentware/opencode-goal-plugin"'
expect "absent cli.json: no backup for a file that did not exist" test ! -e "$cli.bak"
expect "rerun exits 0" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "rerun keeps a single entry" cli_has 'c.plugins.length === 1'

# A machine-owned cli.json: comments, a trailing comma, theme/session keys and one plugin
# the user added by hand. Only plugins[] may change.
rm -rf "$XDG_CONFIG_HOME/opencode"
mkdir -p "$XDG_CONFIG_HOME/opencode"
cat > "$cli" <<'EOF'
{
  // set by hand on this machine
  "$schema": "https://opencode.ai/v2/cli.json",
  "theme": "tokyonight",
  "session": { "sidebar": "auto" }, /* keep */
  "plugins": [
    "some-other-plugin",
  ],
}
EOF
cp "$cli" "$WORK/original.json"

expect "existing cli.json: exits 0" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "existing plugins kept, the new one appended once" cli_has \
  'c.plugins[0] === "some-other-plugin" && c.plugins.filter((p) => p === "@prevalentware/opencode-goal-plugin").length === 1'
expect "theme and session survive" cli_has 'c.theme === "tokyonight" && c.session.sidebar === "auto"'
expect "original kept as .bak" cmp -s "$WORK/original.json" "$cli.bak"
expect "second run exits 0" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "second run appends nothing" cli_has \
  'c.plugins.length === 2 && c.plugins.filter((p) => p === "@prevalentware/opencode-goal-plugin").length === 1'

# The object form with options is the same plugin; it must not be duplicated either.
cat > "$cli" <<'EOF'
{
  "plugins": [
    { "package": "@prevalentware/opencode-goal-plugin", "options": { "auto_continue": false } }
  ]
}
EOF
expect "object entry: exits 0" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "object entry: not duplicated" cli_has 'c.plugins.length === 1 && c.plugins[0].options.auto_continue === false'

# A plugins value this script does not own: refuse, do not overwrite the file.
cat > "$cli" <<'EOF'
{
  "plugins": {}
}
EOF
cp "$cli" "$WORK/object.json"
expect_fail "non-array plugins: refused" node "$SCRIPTS/add-opencode-tui-plugin.mjs" "$pkg"
expect "non-array plugins: file untouched" cmp -s "$WORK/object.json" "$cli"

expect_fail "missing package argument: refused" node "$SCRIPTS/add-opencode-tui-plugin.mjs"

[ "$fail" -eq 0 ]
