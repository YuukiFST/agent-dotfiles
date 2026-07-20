#!/usr/bin/env bash
# OpenCode harness setup (Linux/macOS). Run from a clone of this repo.
# NixOS: the curl|sh installers below drop dynamically linked binaries that need
# nix-ld (or steam-run) to exec — enable programs.nix-ld in the system config first.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
cfg="$HOME/.config/opencode"
bin="$HOME/.local/bin"
mkdir -p "$cfg/skills" "$cfg/rules" "$bin"

echo "[1/4] Config files"
"$(dirname "$0")/sync-config.sh" opencode

echo "[2/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk init -g --opencode

echo "[3/4] no-mistakes + agent-browser + portless"
curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh
npm install -g agent-browser
npm install -g portless

echo "[4/4] caveman (ponytail + superpowers resolve from opencode.jsonc on launch)"
npx -y github:JuliusBrussee/caveman -- --only opencode

case ":$PATH:" in *":$bin:"*) ;; *) echo "Note: add $bin to PATH";; esac
echo "Done. Restart OpenCode."
