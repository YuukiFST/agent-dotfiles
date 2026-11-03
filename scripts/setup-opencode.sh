#!/usr/bin/env bash
# OpenCode harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Windows equivalent: scripts/setup-opencode.ps1
set -euo pipefail

echo "[1/7] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

echo "[2/7] Config (AGENTS.md + skills + rules)"
bash "$(dirname "$0")/sync-config.sh" opencode

echo "[3/7] rtk (+ OpenCode plugin)"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g --opencode
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
bash "$(dirname "$0")/sync-config.sh" opencode >/dev/null

echo "[4/7] OpenCode plugins (caveman-lean, ponytail-subagent, goal mode)"
# `plugin add` skips a plugin already in opencode.jsonc without updating it, so `update` follows.
for p in github:YuukiFST/caveman-lean github:YuukiFST/ponytail-subagent @prevalentware/opencode-goal-plugin; do
  opencode plugin add "$p"
  opencode plugin update "$p"
done
# OpenCode 2 loads a plugin's TUI half (sidebar, palette) only from cli.json, which `plugin add`
# never writes. Same run, idempotent, and it keeps the machine's theme/keybinds.
node "$(dirname "$0")/add-opencode-tui-plugin.mjs" "@prevalentware/opencode-goal-plugin"

echo "[5/7] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

echo "[6/7] browser-harness"
bash "$(dirname "$0")/install-browser-harness.sh" ||
  echo "Note: browser-harness install failed (uv-managed Python needs nix-ld on NixOS); see https://github.com/browser-use/browser-harness/blob/main/install.md"

echo "[7/7] fff MCP (retired, unregister)"
bash "$(dirname "$0")/remove-fff.sh"

cat <<'EOF'

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of GLOBAL.md)
- Skills: ~/.agents/skills — OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json(c) holds per-machine MCP/provider state: only the retired mcp.fff key is removed,
  and the first rewrite keeps the original as opencode.json(c).bak

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH), or install opencode from nixpkgs and run
`bash scripts/sync-config.sh opencode` alone.
EOF
