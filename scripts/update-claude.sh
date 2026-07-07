#!/usr/bin/env bash
# Update every external tool the Claude Code harness depends on (Linux/macOS).
# Companion to setup-claude.sh: setup installs, this refreshes to latest.
set -euo pipefail

bin="$HOME/.local/bin"
crg="$HOME/.local/crg-venv"

echo "[1/5] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version

echo "[2/5] no-mistakes"
curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh
no-mistakes --version

echo "[3/5] npm globals (agent-browser, gh-axi, portless)"
npm install -g agent-browser@latest gh-axi@latest portless@latest
agent-browser install   # refresh the bundled browser driver

echo "[4/5] code-review-graph + MCP registration"
if [ -x "$crg/bin/pip" ]; then
  "$crg/bin/pip" install -q --upgrade code-review-graph
else
  python3 -m venv "$crg"
  "$crg/bin/pip" install -q --upgrade pip code-review-graph
fi
if ! claude mcp list 2>/dev/null | grep -q code-review-graph; then
  claude mcp add code-review-graph -s user -- "$crg/bin/code-review-graph" serve
fi

echo "[5/5] Claude Code plugins"
for p in caveman@caveman ponytail@ponytail superpowers@claude-plugins-official; do
  claude plugin update "$p" || true
done
# Re-apply the writing-skills disable (plugin updates restore the file)
for d in "$HOME"/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/writing-skills; do
  [ -f "$d/SKILL.md" ] && mv "$d/SKILL.md" "$d/SKILL.md.disabled"
done

echo "Done. Restart Claude Code to load updated plugins."
