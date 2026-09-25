#!/usr/bin/env bash
# Validate the YAML frontmatter of every SKILL.md one level under each given dir.
# Run: bash scripts/check-skill-frontmatter.sh [dir...]   (default: skills stacks/*/skills)
#
# A harness that cannot parse the frontmatter still loads the skill, with no description,
# so it silently loses every trigger: ui-craft did, over an unquoted ": " (PR #97).
# Rules from https://agentskills.io/specification: name is 1-64 chars of a-z, 0-9 and
# single hyphens, not at either end, equal to the directory name; description is a
# non-empty string of at most 1024 chars. Extra fields (user-invocable, author) are allowed.
# Needs mikefarah yq v4, preinstalled on GitHub's ubuntu runners.
set -uo pipefail
export LC_ALL=C.UTF-8

failed=0
report() {
  printf '%s: %s\n' "$1" "$2" >&2
  failed=1
}

check_skill() {
  local file="$1" dir err name desc_tag desc desc_len
  dir="$(basename "$(dirname "$file")")"

  if [ "$(head -n 1 "$file" | tr -d '\r')" != "---" ]; then
    report "$file" "no frontmatter: first line is not ---"
    return
  fi
  if ! err="$(yq --front-matter=extract '.' "$file" 2>&1 >/dev/null)"; then
    report "$file" "frontmatter is not valid YAML: ${err%%$'\n'*}"
    return
  fi
  if [ "$(yq --front-matter=extract 'tag' "$file")" != "!!map" ]; then
    report "$file" "frontmatter is not a key: value mapping"
    return
  fi

  name="$(yq --front-matter=extract '.name // ""' "$file")"
  if ! [[ "$name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || [ "${#name}" -gt 64 ]; then
    report "$file" "name '$name' must be 1-64 chars of a-z, 0-9 and single inner hyphens"
  elif [ "$name" != "$dir" ]; then
    report "$file" "name '$name' does not match directory '$dir'"
  fi

  # yq's length counts bytes; the spec's limit counts characters, so count in bash
  # under the UTF-8 locale set at the top (PR #99 review).
  desc_tag="$(yq --front-matter=extract '.description | tag' "$file")"
  desc="$(yq --front-matter=extract '.description' "$file")"
  desc_len="${#desc}"
  if [ "$desc_tag" != "!!str" ] || [ "$desc_len" -eq 0 ]; then
    report "$file" "description must be a non-empty string"
  elif [ "$desc_len" -gt 1024 ]; then
    report "$file" "description is $desc_len chars, limit 1024"
  fi
}

if [ "$#" -eq 0 ]; then
  set -- skills stacks/*/skills
fi

found=0
for root in "$@"; do
  [ -d "$root" ] || continue
  while IFS= read -r file; do
    found=1
    check_skill "$file"
  done < <(find "$root" -mindepth 2 -maxdepth 2 -name SKILL.md | sort)
done

if [ "$found" -eq 0 ]; then
  echo "no SKILL.md found under: $*" >&2
  exit 1
fi
exit "$failed"
