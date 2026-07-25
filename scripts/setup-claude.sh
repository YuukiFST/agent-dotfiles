#!/usr/bin/env bash
# Claude Code harness setup (Linux/macOS). Run from a clone of this repo.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
claude="$HOME/.claude"
bin="$HOME/.local/bin"
mkdir -p "$claude/skills" "$claude/rules" "$bin"

echo "[1/4] Config files"
"$(dirname "$0")/sync-config.sh" claude

echo "[2/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g

echo "[3/4] portless + agent-browser + gh-axi"
npm install -g portless agent-browser gh-axi
agent-browser install   # bundled browser driver — without it every agent-browser call fails

echo "[4/4] Plugins"
for m in JuliusBrussee/caveman DietrichGebert/ponytail anthropics/claude-plugins-official kingbootoshi/goal-ledger; do
  claude plugin marketplace add "$m" || true
done
claude plugin install caveman@caveman || true
claude plugin install ponytail@ponytail || true
claude plugin install superpowers@claude-plugins-official || true
claude plugin install goal-ledger@goal-ledger || true

# Disable superpowers:writing-skills — superseded by personal writing-great-skills (duplicate trigger)
for d in "$HOME"/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/writing-skills; do
  [ -f "$d/SKILL.md" ] && mv "$d/SKILL.md" "$d/SKILL.md.disabled"
done

case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: add $bin to PATH";; esac
echo "Done. Restart Claude Code."
