#!/usr/bin/env bash
# Cursor harness setup (Linux/macOS). Run from a clone of this repo.
# NixOS: Cursor itself is not installed here — nixpkgs `code-cursor` repackages the
# official AppImage, so install it declaratively and run this for config only.
set -euo pipefail

echo "[1/2] Config files (skills, rules)"
"$(dirname "$0")/sync-config.sh" cursor

echo "[2/2] Cursor CLI (optional — shares rules with the GUI)"
command -v agent >/dev/null 2>&1 || echo "  not installed: curl https://cursor.com/install -fsS | bash"

cat <<'EOF'

Done. Restart Cursor.

MANUAL STEP — Cursor has no file-backed global rules. Open
  Customize -> Rules -> User Rules
and paste the contents of CLAUDE.md there. Re-paste after editing CLAUDE.md;
no script can automate this. Skills above are synced from disk.
EOF
