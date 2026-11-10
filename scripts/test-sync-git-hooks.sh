#!/usr/bin/env bash
# End-to-end test: the global commit gate sync-config.sh installs keeps working after the
# checkout it was synced from is gone (a removed worktree, a clone switched to an old branch).
# Run: bash scripts/test-sync-git-hooks.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

home="$WORK/home"
stub_bin="$WORK/bin"
checkout="$WORK/checkout"
mkdir -p "$home" "$stub_bin" "$checkout"
# Every git config --global write lands in this file, never in the machine's own.
export GIT_CONFIG_GLOBAL="$WORK/gitconfig"
: > "$GIT_CONFIG_GLOBAL"
# sync_shared writes the rtk config wherever `rtk config` points; a stub that prints no path
# keeps a real rtk on PATH from handing it the machine's file.
printf '#!/bin/sh\nexit 0\n' > "$stub_bin/rtk"
chmod +x "$stub_bin/rtk"

# Sync from a copy of the working tree, then delete the copy: the worktree-removed case.
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard) |
  (cd "$ROOT" && xargs -0 cp --parents -t "$checkout")

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}

sync() { env HOME="$home" PATH="$stub_bin:$PATH" bash "$checkout/scripts/sync-config.sh" cursor; }
for run in 1 2; do
  expect "sync run $run exits 0" sync
done

# Leftovers of an interrupted sync go on the next run.
live="$home/.claude/git-hooks"
mkdir -p "$live.new.orphan" "$live.old"
# On Windows a process whose cwd is the live dir blocks renaming it; the sync has to update
# the files in place instead of aborting. Linux renames a busy dir, so only Git Bash runs this.
locker=""
if command -v pwsh >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
  locker="$(pwsh -NoProfile -Command "(Start-Process pwsh -ArgumentList '-NoProfile','-Command','Start-Sleep 120' -WorkingDirectory '$(cygpath -w "$live")' -PassThru -WindowStyle Hidden).Id" | tr -d '\r')"
  sleep 2
fi
expect "sync exits 0 with leftovers and a busy live dir" sync
[ -z "$locker" ] || { pwsh -NoProfile -Command "Stop-Process -Id $locker -Force"; sleep 1; }
expect "no git-hooks.new.* or .old left behind" \
  bash -c '[ -z "$(ls -d "$1".new.* "$1".old 2>/dev/null)" ]' _ "$live"
rm -rf "$checkout"

hooks_path="$(git config --global --get core.hooksPath || true)"
expect "core.hooksPath points at ~/.claude/git-hooks" test "$hooks_path" -ef "$home/.claude/git-hooks"
for hook in commit-msg pre-push validate-commit-message.sh; do
  expect "$hook is live and matches the repo" cmp -s "$ROOT/git-hooks/$hook" "$home/.claude/git-hooks/$hook"
done
expect "hook tests stay out of the live dir" test ! -e "$home/.claude/git-hooks/test-pre-push.sh"
expect "git-safe-commit is installed" cmp -s "$ROOT/scripts/git-safe-commit.sh" "$home/.local/bin/git-safe-commit"

# The gate itself: a commit carrying an AI attribution trailer is refused in any repo.
repo="$WORK/repo"
git init -q "$repo"
git -C "$repo" config user.name "Test User"
git -C "$repo" config user.email "test@example.invalid"
git -C "$repo" config commit.gpgsign false
git -C "$repo" config core.autocrlf false
echo x > "$repo/x"
git -C "$repo" add x
printf 'feat: add x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' > "$WORK/msg"
expect "commit with an AI trailer is refused after the checkout is gone" \
  bash -c '! HOME="$1" git -C "$2" commit -q -F "$3" 2>/dev/null' _ "$home" "$repo" "$WORK/msg"
expect "a clean commit still goes through" \
  env HOME="$home" git -C "$repo" commit -q -m "feat: add x"

[ "$fail" -eq 0 ]
