#!/usr/bin/env bash
# Move frontend stack from stacks/frontend into active skills/ + rules/, then sync.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"

cp -r "$repo/stacks/frontend/skills/." "$repo/skills/"
cp "$repo/stacks/frontend/rules/frontend.md" "$repo/rules/frontend.md"
echo "Frontend stack copied into skills/ and rules/. Paste stacks/frontend/CLAUDE-snippet.md into CLAUDE.md, then run: bash scripts/sync-config.sh pi"
