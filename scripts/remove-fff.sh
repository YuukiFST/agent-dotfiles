#!/usr/bin/env bash
# Unregister the retired `fff` MCP server from each harness on PATH (Claude Code user scope,
# OpenCode global config) and delete the fff-mcp binary from ~/.local/bin.
# Shared by setup-claude.sh, update-claude.sh and setup-opencode.sh, so a machine set up
# while fff was installed converges on its next setup run. Idempotent.
# Windows equivalent: scripts/remove-fff.ps1
set -euo pipefail

if command -v claude >/dev/null && claude mcp get fff >/dev/null 2>&1; then
  claude mcp remove fff -s user
fi
if command -v opencode >/dev/null; then
  node "$(dirname "$0")/remove-opencode-mcp.mjs" fff
fi
# A running fff-mcp keeps its unlinked file open, so deleting the path is safe here.
rm -f "$HOME/.local/bin/fff-mcp" "$HOME/.local/bin/fff-mcp.download"
