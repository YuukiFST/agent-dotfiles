#!/usr/bin/env bash
# Claude Code harness setup (Linux/macOS). Run from a clone of this repo.
set -euo pipefail

claude="$HOME/.claude"
bin="$HOME/.local/bin"
mkdir -p "$claude/skills" "$claude/rules" "$bin"

echo "[1/6] Config files"
"$(dirname "$0")/sync-config.sh" claude

echo "[2/6] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
"$(dirname "$0")/sync-config.sh" claude >/dev/null

echo "[3/6] fff MCP (retired, unregister)"
bash "$(dirname "$0")/remove-fff.sh"

echo "[4/6] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

echo "[5/6] browser-harness"
bash "$(dirname "$0")/install-browser-harness.sh" ||
  echo "Note: browser-harness install failed (uv-managed Python needs nix-ld on NixOS); see https://github.com/browser-use/browser-harness/blob/main/install.md"

echo "[6/6] Plugins"
for m in YuukiFST/caveman-lean anthropics/claude-plugins-official YuukiFST/ponytail-subagent; do
  claude plugin marketplace add "$m" || true
done
claude plugin install caveman-lean@caveman-lean || true
claude plugin install ponytail-subagent@ponytail-subagent || true

case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: add $bin to PATH";; esac
echo "Done. Restart Claude Code."
