#!/usr/bin/env bash
# Clone-or-pull the design reference repos the ui-polish skill reads.
# They live outside every harness skills dir on purpose: none of their frontmatter
# reaches a session, only the skill's own description does.
# Idempotent: run on a fresh machine or to refresh existing clones.
# Ends with two drift checks: UNROUTED for an upstream skill, or a file in its
# references/ dir, that SKILL.md neither routes nor excludes, MISSING for a REFS/ path any file of this skill cites that
# upstream no longer has. Both surface on the next pull instead of mid-task.
set -euo pipefail
REFS="${UI_REFS:-$HOME/.claude/ui-refs}"
ROUTER="$(dirname "$0")/SKILL.md"
mkdir -p "$REFS"
while read -r name url; do
  dir="$REFS/$name"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" pull -q --ff-only
  else
    git clone -q --depth 1 "$url" "$dir"
  fi
  printf '%-28s %s %s\n' "$name" "$(git -C "$dir" rev-parse --short HEAD)" "$(git -C "$dir" log -1 --format=%cs)"
done <<'REPOS'
jakubkrehel-skills https://github.com/jakubkrehel/skills
emilkowalski-skills https://github.com/emilkowalski/skills
make-interfaces-feel-better https://github.com/jakubkrehel/make-interfaces-feel-better
craft https://github.com/gustavo-fior/craft
REPOS

drift=0
for skill in "$REFS"/*/skills/*/; do
  [ -d "$skill" ] || { echo "No upstream skills found under $REFS/*/skills/"; drift=1; continue; }
  rel="${skill#"$REFS"/}"
  if ! grep -qF "$rel" "$ROUTER"; then
    echo "UNROUTED $rel: add a row to the ui-polish reference table or a line under Not routed"
    drift=1
  fi
done
for ref in "$REFS"/*/skills/*/references/*.md; do
  [ -e "$ref" ] || continue
  rel="${ref#"$REFS"/}"
  if ! grep -qF "$rel" "$ROUTER"; then
    echo "UNROUTED $rel: route its gap-filling sections in the ui-polish reference table, or name it under Not routed"
    drift=1
  fi
done
for cited in $(grep -ohE 'REFS/[A-Za-z0-9._/-]+' "$(dirname "$ROUTER")"/*.md | sort -u); do
  if [ ! -e "$REFS/${cited#REFS/}" ]; then
    echo "MISSING $cited: upstream renamed or removed it; repoint SKILL.md"
    drift=1
  fi
done
[ "$drift" -eq 0 ] && echo "Every upstream skill is routed or excluded, and every cited path exists."
exit 0
