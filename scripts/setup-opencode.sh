#!/usr/bin/env bash
# OpenCode harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Windows equivalent: scripts/setup-opencode.ps1
set -euo pipefail

echo "[1/2] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

echo "[2/2] Config (AGENTS.md + skills + rules)"
bash "$(dirname "$0")/sync-config.sh" opencode

cat <<'EOF'

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of CLAUDE.md)
- Skills: ~/.agents/skills — OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json is NOT touched: it holds per-machine MCP/provider state

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH), or install opencode from nixpkgs and run
`bash scripts/sync-config.sh opencode` alone.
EOF
