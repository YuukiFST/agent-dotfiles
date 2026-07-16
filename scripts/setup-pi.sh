#!/usr/bin/env bash
# pi harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest pi.
#
# pi (github.com/earendil-works/pi) intentionally ships no MCP, no sub-agents and no
# hooks — extensibility is TypeScript extensions instead. So there is no MCP server to
# register here and no rtk hook to wire: skills + AGENTS.md are the whole surface.
set -euo pipefail

echo "[1/2] pi (npm, latest)"
# --ignore-scripts per pi's own install docs.
npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@latest"
pi --version

echo "[2/2] Config files (skills, rules, AGENTS.md)"
"$(dirname "$0")/sync-config.sh" pi

cat <<'EOF'

Done. Restart pi.

Skills land in ~/.agents/skills (pi reads it natively, recursively) and CLAUDE.md
is written to ~/.pi/agent/AGENTS.md as global instructions.

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH). Installing pi from nixpkgs instead is fine — skip
step 1 and run `bash scripts/sync-config.sh pi` alone.
EOF
