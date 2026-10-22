#!/usr/bin/env bash
# Update every external tool the Claude Code harness depends on (Linux/macOS).
# Companion to setup-claude.sh: setup installs, this refreshes to latest.
set -euo pipefail

echo "[0/4] Config files (skills, rules, CLAUDE.md)"
"$(dirname "$0")/sync-config.sh" claude

echo "[1/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version

echo "[2/4] fff MCP"
bash "$(dirname "$0")/install-fff.sh"

echo "[3/4] npm globals (chrome-devtools-axi, gh-axi)"
npm install -g chrome-devtools-axi@latest gh-axi@latest
# pi is updated by setup-pi.sh (re-runnable), not from here — it is a separate harness,
# not a Claude Code dependency.

echo "[4/4] Claude Code plugins"
# SC2043: single-element loop is intentional extension point (more plugins may be added)
# shellcheck disable=SC2043
for p in caveman@caveman; do
  claude plugin update "$p" || true
done

echo "Done. Restart Claude Code to load updated plugins."
