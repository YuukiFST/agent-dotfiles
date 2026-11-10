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
# Leftovers of an interrupted run; best-effort, a busy one waits for the next run.
rm -rf "$dest".new.* "$dest.old" 2>/dev/null || true
tmp="$(mktemp -d "$dest.new.XXXXXX")"
for f in "$src"/*; do
  name="$(basename "$f")"
  case "$name" in test-*) continue ;; esac
  install -m 755 "$f" "$tmp/$name"
done
if { [ ! -d "$dest" ] || mv "$dest" "$dest.old" 2>/dev/null; } && mv "$tmp" "$dest" 2>/dev/null; then
  rm -rf "$dest.old" 2>/dev/null || true
else
  # Windows refuses to rename a dir that is some process's cwd; its files still take a write.
  echo "  warning: could not swap $dest in, updating its files in place" >&2
  mkdir -p "$dest"
  for f in "$tmp"/*; do install -m 755 "$f" "$dest/"; done
  for f in "$dest"/*; do [ -e "$tmp/$(basename "$f")" ] || rm -f "$f"; done
  rm -rf "$tmp"
fi

git config --global core.hooksPath "$dest"
echo "ok core.hooksPath=$dest"
