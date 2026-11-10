#!/usr/bin/env bash
# Copy the hook set from this repo to ~/.claude/git-hooks and point git at it (all repositories).
# A live copy, not the checkout: a hooksPath into git-hooks/ follows whatever branch that
# checkout has out and disappears with a removed worktree, and the gate goes silent with it.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
src="$repo/git-hooks"
dest="$HOME/.claude/git-hooks"

for hook in commit-msg pre-push validate-commit-message.sh; do
  if [ ! -f "$src/$hook" ]; then
    echo "ERRO: hook ausente: $src/$hook" >&2
    exit 1
  fi
done

# Build the new set beside the live one and swap it in, so a commit running mid-sync never
# finds the dir empty. test-*.sh are the hooks' own tests, not hooks.
mkdir -p "$(dirname "$dest")"
tmp="$(mktemp -d "$dest.new.XXXXXX")"
for f in "$src"/*; do
  name="$(basename "$f")"
  case "$name" in test-*) continue ;; esac
  install -m 755 "$f" "$tmp/$name"
done
rm -rf "$dest.old"
if [ -d "$dest" ]; then mv "$dest" "$dest.old"; fi
mv "$tmp" "$dest"
rm -rf "$dest.old"

git config --global core.hooksPath "$dest"
echo "ok core.hooksPath=$dest"
