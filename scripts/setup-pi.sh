#!/usr/bin/env bash
# pi harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest pi.
#
# pi has no built-in MCP — graph review is exposed via a TypeScript extension that
# shells out to the code-review-graph CLI.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
crg="$HOME/.local/crg-venv"
bin="$HOME/.local/bin"
mkdir -p "$bin"

echo "[1/4] pi (npm, latest)"
if command -v pi >/dev/null 2>&1; then
  echo "  pi already on PATH: $(command -v pi)"
  pi --version
else
  # --ignore-scripts per pi's own install docs.
  npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@latest"
  pi --version
fi

echo "[2/4] code-review-graph CLI"
if [ -x "$crg/bin/pip" ]; then
  "$crg/bin/pip" install -q --upgrade code-review-graph
else
  python3 -m venv "$crg"
  "$crg/bin/pip" install -q --upgrade pip code-review-graph
fi
ln -sf "$crg/bin/code-review-graph" "$bin/code-review-graph"
"$bin/code-review-graph" --version

echo "[3/4] pi agent config (extensions + packages from pi/)"
"$(dirname "$0")/sync-config.sh" pi

# Cursor SDK provider can also use configured MCP servers.
mcp="$HOME/.cursor/mcp.json"
mkdir -p "$HOME/.cursor"
if [ ! -f "$mcp" ]; then
  cat > "$mcp" <<EOF
{
  "mcpServers": {
    "code-review-graph": {
      "command": "$bin/code-review-graph",
      "args": ["serve"]
    }
  }
}
EOF
  echo "  wrote $mcp"
elif grep -q code-review-graph "$mcp"; then
  echo "  $mcp already registers code-review-graph — left untouched"
else
  echo "  NOTE: $mcp exists; add code-review-graph server by hand (see setup-cursor.sh)"
fi

echo "[4/4] done"

cat <<'EOF'

Done. Restart pi.

- Agent config: ~/.pi/agent (synced from pi/)
- Skills: ~/.agents/skills · global instructions: ~/.pi/agent/AGENTS.md
- Goal tracking: /goal, /create-goal (pi-codex-goal)
- Graph tools: crg_detect_changes, crg_impact_radius, crg_query_graph,
  crg_semantic_search, crg_architecture_overview, crg_status
- Build a graph per repo: /crg-build or `code-review-graph build`

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH). Installing pi from nixpkgs instead is fine — skip
step 1 and run `bash scripts/sync-config.sh pi` alone.
EOF
