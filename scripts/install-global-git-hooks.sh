#!/usr/bin/env bash
# Point git at the global hook set from this repo (all repositories).
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
hooks="$repo/git-hooks"

for hook in commit-msg pre-push validate-commit-message.sh; do
  if [ ! -f "$hooks/$hook" ]; then
    echo "ERRO: hook ausente: $hooks/$hook" >&2
    exit 1
  fi
done

chmod +x "$hooks"/commit-msg "$hooks"/pre-push "$hooks"/validate-commit-message.sh

git config --global core.hooksPath "$hooks"
echo "ok core.hooksPath=$hooks"
