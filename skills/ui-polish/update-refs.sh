#!/usr/bin/env bash
# Clone-or-pull the design reference repos the ui-polish skill reads.
# They live outside every harness skills dir on purpose: none of their frontmatter
# reaches a session, only the skill's own description does.
# Idempotent: run on a fresh machine or to refresh existing clones. A repo with a
# third column is cloned sparse, that subdirectory only. A clone left in REFS by a
# repo dropped from the list is ignored, never read.
# Ends with two drift checks: UNROUTED for an upstream skill, or a file in its
# references/ dir, that SKILL.md neither routes nor excludes, MISSING for a REFS/ path any file of this skill cites that
# upstream no longer has, or a **bold** section name no upstream heading or label
# still carries. All surface on the next pull instead of mid-task.
set -euo pipefail
REFS="${UI_REFS:-$HOME/.claude/ui-refs}"
ROUTER="$(dirname "$0")/SKILL.md"
mkdir -p "$REFS"
roots=()
while read -r name url sparse; do
  dir="$REFS/$name"
  before=""
  if [ -d "$dir/.git" ]; then
    before="$(git -C "$dir" rev-parse HEAD)"
    git -C "$dir" pull -q --ff-only
  elif [ -n "$sparse" ]; then
    git clone -q --depth 1 --filter=blob:none --sparse "$url" "$dir"
  else
    git clone -q --depth 1 "$url" "$dir"
  fi
  # Every run, so a full clone, a clone cut short or a changed path converges.
  [ -z "$sparse" ] || git -C "$dir" sparse-checkout set "$sparse"
  printf '%-28s %s %s' "$name" "$(git -C "$dir" rev-parse --short HEAD)" "$(git -C "$dir" log -1 --format=%cs)"
  # A pull that moved HEAD names its range, so a rule changed under an unchanged heading shows too.
  if [ -n "$before" ] && [ "$before" != "$(git -C "$dir" rev-parse HEAD)" ]; then
    printf ', %s new commits: git -C %s log -p %s..HEAD' \
      "$(git -C "$dir" rev-list --count "$before..HEAD")" "$dir" "${before:0:7}"
  fi
  echo
  roots+=("$dir/${sparse:-skills}")
done <<'REPOS'
jakubkrehel-skills https://github.com/jakubkrehel/skills
emilkowalski-skills https://github.com/emilkowalski/skills
mengto-skills https://github.com/MengTo/Skills agent-skills/ui
REPOS

drift=0
for root in "${roots[@]}"; do
  [ -d "$root" ] || { echo "No upstream skills found under $root"; drift=1; continue; }
  for skill in "$root"/*/; do
    rel="${skill#"$REFS"/}"
    if ! grep -qF "$rel" "$ROUTER"; then
      echo "UNROUTED $rel: add a row to the ui-polish reference table or a line under Not routed"
      drift=1
    fi
  done
done
for ref in "${roots[@]/%//*/references/*.md}"; do
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
# skill cites one as a **bold** name. A line splits at each backticked token: a
# token naming an upstream skill (`animate`, `animate/SKILL.md`) or a path under
# REFS (with or without the REFS/ prefix)
# binds the bold names after it, up to the next token, and a bare `*.md` token
# keeps the skill bound before it; a table cell border or a link to a sibling
# file ends the binding. A bound name must be in that skill; an unbound one,
# only in some upstream skill. Names this skill defines are local: a
# `- **term**` list item, a `| **term** |` table cell, a listed emphasis, and,
# for unbound names only, one of its own headings. Builtins only past this
# point: a fork per line costs minutes in Git Bash.
SKILL_DIR="$(dirname "$ROUTER")"
declare -A local_term local_heading target_of labels_of
local_term["project's design system is the direction"]=1
while IFS= read -r term; do
  term="${term%$'\r'}"; term="${term#*\*\*}"; term="${term%%\*\**}"; local_term["${term%.}"]=1
done < <(grep -ohE '^ *([0-9]+\.|-) \*\*[^*]+\*\*|\| \*\*[^*]+\*\* \|' "$SKILL_DIR"/*.md || true)
while IFS= read -r heading; do
  heading="${heading%$'\r'}"; local_heading["${heading,,}"]=1
done < <(grep -ohE '^#{1,6} .*' "$SKILL_DIR"/*.md | sed -E 's/^#+ +//; s/^[0-9]+\. +//; s/ \(.*\)$//' || true)
labels_in() { grep -rhE --include='*.md' '^#{1,6} |\*\*' "$@" 2>/dev/null || true; }
upstream_labels="$(labels_in "${roots[@]}")"
resolve_token() { # sets target_of[$1] to the skill dir or REFS/ file it names, or empty
  [ -n "${target_of[$1]+set}" ] && return 0
  local found="" dir
  if [[ "$1" == REFS/* ]]; then
    [ -e "$REFS/${1#REFS/}" ] && found="$REFS/${1#REFS/}"
  elif [[ "$1" == */* && -e "$REFS/$1" ]]; then
    found="$REFS/$1"
  else
    for dir in "${roots[@]/%//${1%%/*}}"; do [ -d "$dir" ] && found="$dir"; done
  fi
  target_of[$1]="$found"
  [ -z "$found" ] || labels_of[$found]="$(labels_in "$found")"
}
check_names() { # $1 = file:line, $2 = text, $3 = cited token, $4 = its target or empty
  local where="$1" text="$2" name
  while [[ "$text" =~ \*\*([^*]+)\*\* ]]; do
    text="${text#*"${BASH_REMATCH[0]}"}"
    name="${BASH_REMATCH[1]%.}"
    [ -n "${local_term[$name]+set}" ] && continue
    if [ -n "$4" ]; then
      [[ "${labels_of[$4]}" == *"$name"* ]] && continue
      echo "MISSING section **$name** at $where, cited from $3: upstream renamed or removed it; repoint the citation"
    else
      [ -n "${local_heading[${name,,}]+set}" ] && continue
      [[ "$upstream_labels" == *"$name"* ]] && continue
      echo "MISSING section **$name** at $where: no upstream skill has it; repoint the citation, or define it as a local term"
    fi
    drift=1
  done
}
link_re='\[[^]]*\]\([^)]*\.md\)'
segment_re='^`([^`]+)`([^`]*)'
for file in "$SKILL_DIR"/*.md; do
  number=0
  while IFS= read -r line || [ -n "$line" ]; do
    number=$((number + 1))
    line="${line%$'\r'}"
    [[ "$line" == *'**'* ]] || continue
    where="${file##*/}:$number"
    line="${line// | /\`|\`}"
    while [[ "$line" =~ $link_re ]]; do line="${line/"${BASH_REMATCH[0]}"/\`|\`}"; done
    check_names "$where" "${line%%\`*}" "" ""
    rest="${line#"${line%%\`*}"}"
    bound="" bound_token=""
    while [[ "$rest" =~ $segment_re ]]; do
      rest="${rest#"${BASH_REMATCH[0]}"}"
      token="${BASH_REMATCH[1]}"
      text="${BASH_REMATCH[2]}"
      resolve_token "$token"
      if [ -n "${target_of[$token]}" ]; then
        bound="${target_of[$token]}" bound_token="$token"
      elif [[ "$token" != *.md ]]; then
        bound="" bound_token=""
      fi
      check_names "$where" "$text" "$bound_token" "$bound"
    done
  done < "$file"
done
[ "$drift" -eq 0 ] && echo "Every upstream skill is routed or excluded, and every cited path and section exists."
exit 0
