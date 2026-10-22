#!/usr/bin/env bash
# Download the latest stable fff-mcp into ~/.local/bin and register it as the `fff` MCP server
# in each harness on PATH: Claude Code (user scope) and OpenCode (global config).
# Shared by setup-claude.sh, update-claude.sh and setup-opencode.sh.
# Idempotent: re-running refreshes the binary. Windows equivalent: scripts/install-fff.ps1
#
# Not upstream's install-mcp.sh: it installs the newest release with a matching asset, a nightly.
set -euo pipefail

case "$(uname -s)" in
  Linux) os=unknown-linux-musl ;;
  Darwin) os=apple-darwin ;;
  *) echo "install-fff: no fff-mcp build for $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64 ;;
  arm64 | aarch64) arch=aarch64 ;;
  *) echo "install-fff: no fff-mcp build for $(uname -m)" >&2; exit 1 ;;
esac

bin="$HOME/.local/bin"
mkdir -p "$bin"
curl -fsSL -o "$bin/fff-mcp.download" \
  "https://github.com/dmtrKovalenko/fff/releases/latest/download/fff-mcp-$arch-$os"
chmod +x "$bin/fff-mcp.download"
# mv swaps the path, so a fff-mcp already running from an open agent session keeps its old file.
mv -f "$bin/fff-mcp.download" "$bin/fff-mcp"
"$bin/fff-mcp" --version

if command -v claude >/dev/null; then
  claude mcp remove fff -s user >/dev/null 2>&1 || true
  claude mcp add -s user fff -- "$bin/fff-mcp"
fi
if command -v opencode >/dev/null; then
  node "$(dirname "$0")/set-opencode-mcp.mjs" fff "$bin/fff-mcp"
fi
