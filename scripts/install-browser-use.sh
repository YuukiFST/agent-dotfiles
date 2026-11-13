#!/usr/bin/env bash
# Install or upgrade the browser-use CLI with uv, installing uv into ~/.local/bin first when it is missing.
# Shared by setup-claude.sh, setup-opencode.sh and update-claude.sh. Idempotent: re-running upgrades in place.
# browser-use pins the browser-harness engine and replaces its standalone CLI (browser-harness README),
# so a leftover browser-harness tool is uninstalled to keep one daemon and one skill text on PATH.
# Python 3.12 is pinned because uv otherwise picks old releases that still support older Pythons.
set -euo pipefail

if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
uv tool install --python 3.12 --upgrade --force browser-use
if uv tool list | grep -q '^browser-harness '; then uv tool uninstall browser-harness; fi
browser-use --version
