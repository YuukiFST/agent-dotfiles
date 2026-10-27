#!/usr/bin/env bash
# OpenCode harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Windows equivalent: scripts/setup-opencode.ps1
set -euo pipefail

echo "[1/6] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

echo "[2/6] Config (AGENTS.md + skills + rules)"
bash "$(dirname "$0")/sync-config.sh" opencode

echo "[3/6] rtk (+ OpenCode plugin)"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g --opencode
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
bash "$(dirname "$0")/sync-config.sh" opencode >/dev/null

echo "[4/6] caveman-lean + ponytail-subagent (OpenCode plugins)"
# `plugin add` skips a plugin already in opencode.jsonc without updating it, so `update` follows.
for p in github:YuukiFST/caveman-lean github:YuukiFST/ponytail-subagent; do
  opencode plugin add "$p"
  opencode plugin update "$p"
done

echo "[5/6] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

echo "[6/6] fff MCP"
bash "$(dirname "$0")/install-fff.sh"

cat <<'EOF'

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of GLOBAL.md)
- Skills: ~/.agents/skills — OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json(c) holds per-machine MCP/provider state: only its mcp.fff key is set,
  and the first rewrite keeps the original as opencode.json(c).bak

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH), or install opencode from nixpkgs and run
`bash scripts/sync-config.sh opencode` alone.
EOF
