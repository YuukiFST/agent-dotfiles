#!/usr/bin/env bash
# Install or upgrade browser-harness with uv, installing uv into ~/.local/bin first when it is missing.
# Shared by setup-claude.sh, setup-opencode.sh and update-claude.sh. Idempotent: re-running upgrades in place.
# Python 3.12 is pinned because uv otherwise picks old releases that still support older Pythons (upstream install.md).
set -euo pipefail

if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
uv tool install --python 3.12 --upgrade --force browser-harness
browser-harness --version
