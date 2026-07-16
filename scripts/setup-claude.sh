#!/usr/bin/env bash
# Claude Code harness setup (Linux/macOS). Run from a clone of this repo.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
claude="$HOME/.claude"
bin="$HOME/.local/bin"
crg="$HOME/.local/crg-venv"
mkdir -p "$claude/skills" "$claude/rules" "$bin"

echo "[1/5] Config files"
"$(dirname "$0")/sync-config.sh" claude

echo "[2/5] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g

echo "[3/5] no-mistakes + code-review-graph + portless + agent-browser + gh-axi"
curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh
python3 -m venv "$crg"
"$crg/bin/pip" install -q --upgrade pip code-review-graph
npm install -g portless agent-browser gh-axi
agent-browser install   # bundled browser driver — without it every agent-browser call fails

echo "[4/5] MCP servers"
# agent-browser (agent-browser.dev) is a shell CLI for agents, NOT an MCP server — installed
# above and called directly via Bash. Kept in the remove loop only to clean any stale entry.
for n in code-review-graph agent-browser; do claude mcp remove "$n" -s user 2>/dev/null || true; done
claude mcp add code-review-graph -s user -- "$crg/bin/code-review-graph" serve

echo "[5/5] Plugins"
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
