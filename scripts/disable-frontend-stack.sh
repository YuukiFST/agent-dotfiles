#!/usr/bin/env bash
# Move active frontend skills back to stacks/frontend and remove frontend rule.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$repo/stacks/frontend/skills" "$repo/stacks/frontend/rules"
for s in "$repo"/stacks/frontend/skills/*/; do
  [ -d "$s" ] || continue
  name="$(basename "$s")"
  if [ -d "$repo/skills/$name" ]; then
    rm -rf "$repo/stacks/frontend/skills/$name"
    mv "$repo/skills/$name" "$repo/stacks/frontend/skills/$name"
  fi
done
if [ -f "$repo/rules/frontend.md" ]; then
  mv "$repo/rules/frontend.md" "$repo/stacks/frontend/rules/frontend.md"
fi
echo "Frontend stack archived. Remove CLAUDE-snippet lines from CLAUDE.md, then run: bash scripts/sync-config.sh pi"
