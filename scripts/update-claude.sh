#!/usr/bin/env bash
# Update every external tool the Claude Code harness depends on (Linux/macOS).
# Companion to setup-claude.sh: setup installs, this refreshes to latest.
set -euo pipefail

echo "[0/5] Config files (skills, rules, CLAUDE.md)"
"$(dirname "$0")/sync-config.sh" claude

echo "[1/5] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version

echo "[2/5] fff MCP (retired, unregister)"
bash "$(dirname "$0")/remove-fff.sh"

echo "[3/5] npm globals (chrome-devtools-axi, gh-axi)"
npm install -g chrome-devtools-axi@latest gh-axi@latest
# pi is updated by setup-pi.sh (re-runnable), not from here — it is a separate harness,
# not a Claude Code dependency.

echo "[4/5] browser-harness"
bash "$(dirname "$0")/install-browser-harness.sh" ||
  echo "Note: browser-harness install failed (uv-managed Python needs nix-ld on NixOS); see https://github.com/browser-use/browser-harness/blob/main/install.md"

echo "[5/5] Claude Code plugins"
for p in caveman-lean@caveman-lean ponytail-subagent@ponytail-subagent; do
  claude plugin update "$p" || true
done

echo "Done. Restart Claude Code to load updated plugins."
