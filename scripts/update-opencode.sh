#!/usr/bin/env bash
# Update every external tool the OpenCode harness depends on (Linux/macOS).
# Companion to setup-opencode.sh: setup installs, this refreshes to latest.
set -euo pipefail

bin="$HOME/.local/bin"
crg="$HOME/.local/crg-venv"

echo "[1/4] rtk"
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version

echo "[2/4] no-mistakes"
curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh | sh
no-mistakes --version

echo "[3/4] npm globals (agent-browser, portless) + code-review-graph"
npm install -g agent-browser@latest portless@latest
agent-browser install   # refresh the bundled browser driver
if [ -x "$crg/bin/pip" ]; then
  "$crg/bin/pip" install -q --upgrade code-review-graph
else
  python3 -m venv "$crg"
  "$crg/bin/pip" install -q --upgrade pip code-review-graph
fi
ln -sf "$crg/bin/code-review-graph" "$bin/code-review-graph"

echo "[4/4] caveman (ponytail + superpowers resolve from opencode.jsonc on launch)"
npx -y github:JuliusBrussee/caveman -- --only opencode

echo "Done. Restart OpenCode."
