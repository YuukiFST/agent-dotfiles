#!/usr/bin/env bash
# Claude Code harness setup (Linux/macOS). Run from a clone of this repo.
set -euo pipefail

claude="$HOME/.claude"
bin="$HOME/.local/bin"
mkdir -p "$claude/skills" "$claude/rules" "$bin"

echo "[1/5] Config files"
"$(dirname "$0")/sync-config.sh" claude

echo "[2/5] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
"$(dirname "$0")/sync-config.sh" claude >/dev/null

echo "[3/5] fff MCP"
bash "$(dirname "$0")/install-fff.sh"

echo "[4/5] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

echo "[5/5] Plugins"
for m in YuukiFST/caveman-lean anthropics/claude-plugins-official YuukiFST/ponytail-subagent; do
  claude plugin marketplace add "$m" || true
done
claude plugin install caveman-lean@caveman-lean || true
claude plugin install ponytail-subagent@ponytail-subagent || true

case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: add $bin to PATH";; esac
echo "Done. Restart Claude Code."
