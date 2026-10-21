#!/usr/bin/env bash
# Clone-or-pull the design reference repos the ui-polish skill reads.
# They live outside every harness skills dir on purpose: none of their frontmatter
# reaches a session, only the skill's own description does.
# Idempotent: run on a fresh machine or to refresh existing clones.
# Ends with two drift checks: UNROUTED for an upstream skill, or a file in its
# references/ dir, that SKILL.md neither routes nor excludes, MISSING for a REFS/ path any file of this skill cites that
# upstream no longer has, or a **bold** section name no upstream heading or label
# still carries. All surface on the next pull instead of mid-task.
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
# Section citations. Upstream names a section by heading or bold label, and this
# skill cites one as a **bold** name. In a clause opened by a backticked upstream
# skill (`animate`, `animate/SKILL.md`) or REFS/ path, the name must still be in
# that skill; any other bold name must be in some upstream skill. A name this
# skill defines itself is local: a heading, a `- **term**` list item, a
# `| **term** |` table cell, or the emphasis named here.
SKILL_DIR="$(dirname "$ROUTER")"
local_emphasis="project's design system is the direction"
local_headings="$(grep -ohE '^#{1,6} .*' "$SKILL_DIR"/*.md)"
local_terms="$(grep -ohE '^ *([0-9]+\.|-) \*\*[^*]+\*\*|\| \*\*[^*]+\*\* \|' "$SKILL_DIR"/*.md | sed 's/\.\*\*/**/')"
is_local() {
  [ "$1" = "$local_emphasis" ] || grep -qiF -- "$1" <<<"$local_headings" || grep -qF -- "**$1**" <<<"$local_terms"
}
labels_in() { grep -rhE --include='*.md' '^#{1,6} |\*\*' "$@"; }
bold_names() { grep -oE '\*\*[^*]+\*\*' | sed -E 's/^\*\*//; s/\*\*$//; s/\.$//'; }
section_target() {
  case "$1" in
    REFS/*) [ -e "$REFS/${1#REFS/}" ] && echo "$REFS/${1#REFS/}"; return 0 ;;
  esac
  for dir in "$REFS"/*/skills/"${1%%/*}"; do
    [ -d "$dir" ] && echo "$dir"
  done
  return 0
}
checked=""
while IFS= read -r clause; do
  token="${clause#\`}"
  token="${token%%\`*}"
  mapfile -t targets < <(section_target "$token")
  [ "${#targets[@]}" -gt 0 ] || continue
  while IFS= read -r name; do
    is_local "$name" && continue
    checked+="$name"$'\n'
    labels_in "${targets[@]}" | grep -qF -- "$name" && continue
    echo "MISSING section **$name** in $token: upstream renamed or removed it; repoint the citation"
    drift=1
  done < <(bold_names <<<"$clause")
done < <(grep -ohE '`[^`]+`[^`;.]*' "$SKILL_DIR"/*.md | sort -u)
upstream_labels="$(labels_in "$REFS"/*/skills)"
while IFS= read -r name; do
  is_local "$name" && continue
  grep -qxF -- "$name" <<<"$checked" && continue
  grep -qF -- "$name" <<<"$upstream_labels" && continue
  echo "MISSING section **$name**: no upstream skill has it; repoint the citation, or define it here if it is a local term"
  drift=1
done < <(cat "$SKILL_DIR"/*.md | bold_names | sort -u)
[ "$drift" -eq 0 ] && echo "Every upstream skill is routed or excluded, and every cited path and section exists."
exit 0
