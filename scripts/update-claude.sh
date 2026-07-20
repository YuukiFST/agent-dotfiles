#!/usr/bin/env bash
# Update every external tool the Claude Code harness depends on (Linux/macOS).
# Companion to setup-claude.sh: setup installs, this refreshes to latest.
set -euo pipefail

bin="$HOME/.local/bin"

echo "[0/4] Config files (skills, rules, CLAUDE.md)"
"$(dirname "$0")/sync-config.sh" claude

echo "[1/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version

echo "[2/4] no-mistakes"
curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh
no-mistakes --version

echo "[3/4] npm globals (agent-browser, gh-axi, portless)"
npm install -g agent-browser@latest gh-axi@latest portless@latest
agent-browser install   # refresh the bundled browser driver
# pi is updated by setup-pi.sh (re-runnable), not from here — it is a separate harness,
# not a Claude Code dependency.

echo "[4/4] Claude Code plugins"
claude mcp remove code-review-graph -s user 2>/dev/null || true
for p in caveman@caveman ponytail@ponytail superpowers@claude-plugins-official; do
  claude plugin update "$p" || true
done
# Re-apply the writing-skills disable (plugin updates restore the file)
for d in "$HOME"/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/writing-skills; do
  [ -f "$d/SKILL.md" ] && mv "$d/SKILL.md" "$d/SKILL.md.disabled"
done

echo "Done. Restart Claude Code to load updated plugins."
