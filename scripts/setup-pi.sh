#!/usr/bin/env bash
# pi harness setup (Linux/macOS). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest pi.
set -euo pipefail

bin="$HOME/.local/bin"
mkdir -p "$bin"

echo "[1/4] pi (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when pi is on PATH would never update.
# --ignore-scripts per pi's own install docs.
npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@latest"
pi --version

echo "[2/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
export PATH="$bin:$PATH"
rtk init -g --agent pi --auto-patch

echo "[3/4] pi agent config (extensions + packages from pi/)"
bash "$(dirname "$0")/sync-config.sh" pi

echo "[4/4] done"

case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: add $bin to PATH (rtk resolves from it)";; esac

cat <<'EOF'

Done. Restart pi.

- Agent config: ~/.pi/agent (synced from pi/)
- Skills: ~/.agents/skills · global instructions: ~/.pi/agent/AGENTS.md
- RTK: ~/.pi/agent/extensions/rtk.ts rewrites bash → rtk (prisma/tsc/vitest: run raw)
- Goal tracking: /goal, /create-goal (pi-codex-goal)

NixOS: `npm install -g` needs a writable prefix (npm config set prefix ~/.npm-global,
with ~/.npm-global/bin on PATH). Installing pi from nixpkgs instead is fine — skip
step 1 and run `bash scripts/sync-config.sh pi` alone.
EOF
