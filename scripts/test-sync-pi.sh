#!/usr/bin/env bash
# Regression test for sync-config.sh pi: the live ~/.pi/agent must hold no package.json,
# because its "type" reaches pi's CommonJS launcher in bin/ (#148, #150).
# Run: bash scripts/test-sync-pi.sh
set -uo pipefail

SYNC="$(cd "$(dirname "$0")" && pwd)/sync-config.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

home="$WORK/home"
agent="$home/.pi/agent"
stub_bin="$WORK/bin"
mkdir -p "$agent/bin" "$stub_bin"

# State an earlier sync left behind: the repo's package.json and the #149 override.
printf '{ "type": "module" }\n' > "$agent/package.json"
printf '{ "type": "commonjs" }\n' > "$agent/bin/package.json"
# CommonJS like the launcher pi's Windows installer writes; pi on PATH goes through it.
cat > "$agent/bin/pi-launcher.js" <<'EOF'
const fs = require("node:fs");
if (process.argv[2] !== "--version") fs.appendFileSync(process.env.PI_STUB_LOG, process.argv.slice(2).join(" ") + "\n");
console.log("pi stub");
EOF
cat > "$stub_bin/pi" <<'EOF'
#!/bin/sh
exec node "$HOME/.pi/agent/bin/pi-launcher.js" "$@"
EOF
chmod +x "$stub_bin/pi"
export PI_STUB_LOG="$WORK/installs.log"
: > "$PI_STUB_LOG"

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}

for run in 1 2; do
  expect "sync run $run exits 0" env HOME="$home" PATH="$stub_bin:$PATH" bash "$SYNC" pi
done
expect "no package.json in ~/.pi/agent" test ! -e "$agent/package.json"
expect "no package.json in ~/.pi/agent/bin" test ! -e "$agent/bin/package.json"
expect "CommonJS launcher runs" node "$agent/bin/pi-launcher.js" --version
expect "caveman declares its own module type" grep -q '"module"' "$agent/extensions/caveman/package.json"
expect "settings.json packages installed through the launcher" test -s "$PI_STUB_LOG"
expect "GLOBAL.md lands as ~/.pi/agent/AGENTS.md" cmp -s "$(dirname "$SYNC")/../GLOBAL.md" "$agent/AGENTS.md"

[ "$fail" -eq 0 ]
