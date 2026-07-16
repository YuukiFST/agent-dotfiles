#!/usr/bin/env bash
# Cursor harness setup (Linux/macOS). Run from a clone of this repo.
# NixOS: Cursor itself is not installed here — nixpkgs `code-cursor` repackages the
# official AppImage, so install it declaratively and run this for config only.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
crg="$HOME/.local/crg-venv"
bin="$HOME/.local/bin"
mkdir -p "$bin"

echo "[1/3] Config files (skills, rules)"
"$(dirname "$0")/sync-config.sh" cursor

echo "[2/3] code-review-graph + MCP registration"
if [ -x "$crg/bin/pip" ]; then
  "$crg/bin/pip" install -q --upgrade code-review-graph
else
  python3 -m venv "$crg"
  "$crg/bin/pip" install -q --upgrade pip code-review-graph
fi
ln -sf "$crg/bin/code-review-graph" "$bin/code-review-graph"

# Never clobber an existing mcp.json — it may hold servers this repo knows nothing about.
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
  echo "  NOTE: $mcp exists; add this server by hand:"
  echo '        "code-review-graph": { "command": "'"$bin"'/code-review-graph", "args": ["serve"] }'
fi

echo "[3/3] Cursor CLI (optional — shares rules/MCP with the GUI)"
command -v agent >/dev/null 2>&1 || echo "  not installed: curl https://cursor.com/install -fsS | bash"

cat <<'EOF'

Done. Restart Cursor.

MANUAL STEP — Cursor has no file-backed global rules. Open
  Customize -> Rules -> User Rules
and paste the contents of CLAUDE.md there. Re-paste after editing CLAUDE.md;
no script can automate this. Skills and MCP above are synced from disk.
EOF
