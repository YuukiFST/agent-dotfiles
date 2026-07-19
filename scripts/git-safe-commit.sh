#!/usr/bin/env bash
# Create a commit via commit-tree (bypasses Cursor's git commit Co-authored-by injection).
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: git-safe-commit.sh -m "message" [--author "Name <email>"]

Creates a commit from the current index without calling `git commit`.
Use this from Cursor (or any harness that injects Co-authored-by trailers).

Author and committer are set to the same identity.
EOF
  exit 1
}

author=""
message=""

while [ $# -gt 0 ]; do
  case "$1" in
    -m)
      shift
      message="${1:?missing message for -m}"
      ;;
    --author)
      shift
      author="${1:?missing value for --author}"
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "argumento desconhecido: $1" >&2
      usage
      ;;
  esac
  shift
done

[ -n "$message" ] || usage

if [ -z "$author" ]; then
  author="${GIT_AUTHOR_NAME:-$(git config user.name)} <${GIT_AUTHOR_EMAIL:-$(git config user.email)}>"
fi

if git diff --cached --quiet; then
  echo "ERRO: nada staged. Use git add antes de commitar." >&2
  exit 1
fi

author_name="${author%% <*}"
author_email="${author#*<}"
author_email="${author_email%>}"

tree="$(git write-tree)"
parents=()
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  parents=(-p "$(git rev-parse HEAD)")
fi

msg_file="$(mktemp)"
printf '%s\n' "$message" > "$msg_file"

export GIT_AUTHOR_NAME="$author_name"
export GIT_AUTHOR_EMAIL="$author_email"
export GIT_COMMITTER_NAME="$author_name"
export GIT_COMMITTER_EMAIL="$author_email"

new_commit="$(git commit-tree "$tree" "${parents[@]}" -F "$msg_file")"
rm -f "$msg_file"

git update-ref HEAD "$new_commit"
echo "$new_commit"
