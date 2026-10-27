#!/usr/bin/env bash
# List the vendored skills, hooks and plugins whose upstream changed past the
# commit pinned in skills/UPSTREAMS.tsv (refresh procedure in that file's header).
# Usage: check-upstreams.sh [--markdown] [target...]
# Exit: 0 every checked row is current, 2 at least one row changed, 1 a row could
# not be checked (local target gone, or repo or pin gone upstream).
# Needs an authenticated gh; UPSTREAMS_FILE points it at another manifest.
set -uo pipefail

manifest="${UPSTREAMS_FILE:-$(cd "$(dirname "$0")/.." && pwd)/skills/UPSTREAMS.tsv}"
skills_dir="$(dirname "$manifest")"
repo_root="$(dirname "$skills_dir")"
format=text
if [ "${1:-}" = --markdown ]; then format=markdown; shift; fi
max_listed=10

checked=0 changed=0 failed=0

report_error() { # $1 = skill, $2 = source, $3 = reason
  failed=$((failed + 1))
  if [ "$format" = markdown ]; then
    printf '## %s: error\n\n`%s`: %s\n\n' "$1" "$2" "$3"
  else
    printf 'ERROR    %s  %s: %s\n' "$1" "$2" "$3"
  fi
}

report_change() { # $1 = skill, $2 = repo, $3 = path, $4 = pin, $5 = newline-separated "sha date subject"
  local count latest latest_date compare line
  count="$(printf '%s\n' "$5" | wc -l | tr -d ' ')"
  latest="${5%%$'\n'*}"; latest_date="${latest#* }"; latest_date="${latest_date%% *}"; latest="${latest%% *}"
  compare="https://github.com/$2/compare/$4...$latest"
  changed=$((changed + 1))
  if [ "$format" = markdown ]; then
    printf '## %s: `%s` `%s`\n\n%s commits past `%s`, latest `%s` (%s). [Compare](%s)\n\n' \
      "$1" "$2" "$3" "$count" "$4" "$latest" "$latest_date" "$compare"
    # A code span keeps a subject's #123 and @user from linking or pinging in the issue.
    printf '%s\n' "$5" | head -n "$max_listed" | while IFS= read -r line; do
      printf -- '- `%s`\n' "${line//\`/\'}"
    done
  else
    printf 'CHANGED  %s  %s %s: %s commits past %s, latest %s (%s)\n  %s\n' \
      "$1" "$2" "$3" "$count" "$4" "$latest" "$latest_date" "$compare"
    printf '%s\n' "$5" | head -n "$max_listed" | sed 's/^/    /'
  fi
  [ "$count" -le "$max_listed" ] || printf '%s%s more\n' "$([ "$format" = markdown ] && echo '- ' || echo '    ')" "$((count - max_listed))"
  [ "$format" = text ] || echo
}

missing_target() { # $1 = target; prints why a local target is gone, nothing otherwise
  case "$1" in
    ./*) [ -e "$repo_root/${1#./}" ] || echo "no $1 in this repo" ;;
    */*) ;; # a downstream GitHub repo: nothing local to check
    *) [ -d "$skills_dir/$1" ] || echo "no skills/$1 directory" ;;
  esac
}

check_row() { # $1 = target, $2 = repo, $3 = path, $4 = pin, $5 = branch (empty = default)
  local source="$2:$3" missing pin_date query commits
  missing="$(missing_target "$1")"
  [ -z "$missing" ] || { report_error "$1" "$source" "$missing; fix or drop the row"; return; }
  pin_date="$(gh api "repos/$2/commits/$4" --jq .commit.committer.date 2>&1)" \
    || { report_error "$1" "$source" "pin $4 not found upstream: ${pin_date##*$'\n'}"; return; }
  query="since=$pin_date&per_page=100"
  [ "$3" = . ] || query="$query&path=$3"
  [ -z "$5" ] || query="$query&sha=$5"
  commits="$(gh api --paginate "repos/$2/commits?$query" \
    --jq ".[] | select(.sha | startswith(\"$4\") | not) | \"\(.sha[:7]) \(.commit.committer.date[:10]) \(.commit.message | split(\"\n\")[0])\"" 2>&1)" \
    || { report_error "$1" "$source" "commit list failed: ${commits##*$'\n'}"; return; }
  [ -z "$commits" ] || report_change "$1" "$2" "$3" "$4" "$commits"
}

[ -f "$manifest" ] || { echo "No manifest at $manifest" >&2; exit 1; }
while IFS=$'\t' read -r target repo path pin branch _ || [ -n "$target" ]; do
  target="${target%$'\r'}"; pin="${pin%$'\r'}"; branch="${branch%$'\r'}"
  case "$target" in ''|'#'*) continue ;; esac
  if [ $# -gt 0 ] && [[ " $* " != *" $target "* ]]; then continue; fi
  checked=$((checked + 1))
  if [ -z "$pin" ]; then report_error "$target" "$repo:$path" "row needs 4 tab-separated columns"; continue; fi
  check_row "$target" "$repo" "$path" "$pin" "$branch"
done < "$manifest"

summary="$changed of $checked upstream sources changed past their pin, $failed could not be checked."
[ "$checked" -gt 0 ] || summary="No row matched: ${*:-the manifest is empty}."
echo "$summary"
[ "$failed" -eq 0 ] || exit 1
[ "$changed" -eq 0 ] || exit 2
