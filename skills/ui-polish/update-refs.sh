#!/usr/bin/env bash
# Clone-or-pull the design reference repos the ui-polish and ui-craft skills read.
# ui-polish reads the stack-agnostic ones; ui-craft reads those plus libraries-dev.
# They live outside every harness skills dir on purpose: none of their frontmatter
# reaches a session, only the two skills' own descriptions do.
# Idempotent: run on a fresh machine or to refresh existing clones.
# Optional third column = sparse path: Libraries.dev is a 140 MB monorepo
# (packages, sites) and ui-craft reads only its skills/ folder.
set -euo pipefail
REFS="${UI_REFS:-$HOME/.claude/ui-refs}"
mkdir -p "$REFS"
while read -r name url sparse; do
  dir="$REFS/$name"
  if [ -d "$dir/.git" ]; then
    # Re-applied on every run: a clone whose sparse fetch failed has .git but no files.
    if [ -n "$sparse" ]; then git -C "$dir" sparse-checkout set "$sparse"; fi
    git -C "$dir" pull -q --ff-only
  elif [ -n "$sparse" ]; then
    git clone -q --depth 1 --filter=blob:none --sparse "$url" "$dir"
    git -C "$dir" sparse-checkout set "$sparse"
  else
    git clone -q --depth 1 "$url" "$dir"
  fi
  printf '%-28s %s %s\n' "$name" "$(git -C "$dir" rev-parse --short HEAD)" "$(git -C "$dir" log -1 --format=%cs)"
done <<'REPOS'
jakubkrehel-skills https://github.com/jakubkrehel/skills
emilkowalski-skills https://github.com/emilkowalski/skills
make-interfaces-feel-better https://github.com/jakubkrehel/make-interfaces-feel-better
libraries-dev https://github.com/Jakubantalik/Libraries.dev skills
REPOS
