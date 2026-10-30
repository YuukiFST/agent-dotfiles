#!/usr/bin/env bash
# Check that the routes in yuu-mode's SKILL.md and the skills beside it match, both ways.
# Run: bash scripts/check-yuu-mode-routes.sh [skills-dir]   (default: skills)
#
# yuu-mode reads a routed skill by path and, when it is missing, quietly takes the
# next-best route ("Loading a route"), so a skill deleted through REMOVED.txt leaves a
# dead route nobody sees. Every skill except principle-* (they fire on their own
# descriptions) and yuu-mode itself has a route (PR #259).
# A route is a backticked name in the last cell of a table row: a skill's directory name,
# or playbooks/<name>.md under yuu-mode. A skill named only in prose or a playbook step is
# no route, so those get the narrower check that no name listed in REMOVED.txt appears
# backticked anywhere under yuu-mode.
set -uo pipefail

root="${1:-skills}"
router="$root/yuu-mode/SKILL.md"
if [ ! -f "$router" ]; then
  echo "no router at $router" >&2
  exit 1
fi

failed=0
report() {
  printf '%s\n' "$1" >&2
  failed=1
}

# Drop the trailing pipe a row may or may not have, so $NF is the route cell either way.
routes="$(tr -d '\r' < "$router" |
  awk -F'|' '/^[ \t]*[|]/ { sub(/[ \t]*[|]?[ \t]*$/, ""); print $NF }' |
  grep -o '`[^`]*`' | tr -d '`' | sort -u)"

while IFS= read -r route; do
  [ -n "$route" ] || continue
  case "$route" in
    playbooks/*) [ -f "$root/yuu-mode/$route" ] || report "$router: route $route has no file at $root/yuu-mode/$route" ;;
    *) [ -f "$root/$route/SKILL.md" ] || report "$router: route $route has no $root/$route/SKILL.md" ;;
  esac
done <<< "$routes"

for file in "$root"/*/SKILL.md; do
  [ -f "$file" ] || continue
  name="$(basename "$(dirname "$file")")"
  case "$name" in
    yuu-mode | principle-*) continue ;;
  esac
  grep -qxF "$name" <<< "$routes" || report "$root/$name: no route in $router"
done

removed="$root/REMOVED.txt"
if [ -f "$removed" ]; then
  while IFS= read -r name; do
    if hits="$(grep -rnF -- "\`$name\`" "$root/yuu-mode")"; then
      report "$hits"$'\n'"  names $name, which $removed lists as deleted"
    fi
  done < <(sed 's/#.*//' "$removed" | tr -d '\r' | awk 'NF { print $1 }')
fi

[ "$failed" -eq 0 ] && echo "yuu-mode routes ok ($(grep -c . <<< "$routes") routes)"
exit "$failed"
