#!/usr/bin/env bash
# One-command install on a fresh Linux/macOS machine: clone this repo, then set up each harness.
#
#   # auto: set up every harness already on PATH (claude / pi / opencode)
#   curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash
#
#   # pick the harness
#   curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash -s -- pi
#
# stacks/ is NEVER downloaded: the clone is a non-cone sparse checkout that excludes it, so the
# archived stacks cost no disk and cannot leak into a live harness dir. `--full` gets them anyway
# (needed only by `scripts/stack.sh enable <name>`).
#
# Usage: bootstrap.sh [auto|all|claude|pi|opencode] [--full] [--dest DIR] [--ref REF]
set -euo pipefail

repo_url="https://github.com/YuukiFST/agent-dotfiles.git"
target="auto"
dest="$HOME/agent-dotfiles"
ref="main"
full=0

while [ $# -gt 0 ]; do
  case "$1" in
    auto|all|claude|pi|opencode) target="$1"; shift ;;
    --full) full=1; shift ;;
    --dest) dest="$2"; shift 2 ;;
    --ref) ref="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

for dep in git npm; do
  command -v "$dep" >/dev/null 2>&1 || { echo "$dep is required and not on PATH" >&2; exit 1; }
done

# Running from inside an existing clone (scripts/bootstrap.sh) — use it, don't re-clone.
self_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || true)"
if [ -n "$self_repo" ] && [ -f "$self_repo/CLAUDE.md" ]; then
  dest="$self_repo"
  echo "Using the clone this script lives in: $dest"
elif [ -d "$dest/.git" ]; then
  echo "Updating existing clone: $dest"
  git -C "$dest" fetch origin "$ref" --quiet
  git -C "$dest" checkout "$ref" --quiet
  git -C "$dest" pull --ff-only origin "$ref" --quiet
else
  echo "Cloning $repo_url -> $dest"
  git clone --filter=blob:none --no-checkout --branch "$ref" "$repo_url" "$dest"
  if [ "$full" -eq 0 ]; then
    # Non-cone mode is the only one that can express an exclusion. Persists across git pull.
    # Patterns go through --stdin because Git Bash on Windows rewrites a bare `!/stacks/`
    # argument into `!C:/Program Files/Git/stacks/` (MSYS path conversion) and the exclusion
    # then silently matches nothing.
    printf '/*\n!/stacks/\n' | git -C "$dest" sparse-checkout set --no-cone --stdin
  fi
  git -C "$dest" checkout "$ref" --quiet
fi

if [ -d "$dest/stacks" ]; then
  echo "  note: stacks/ is present in this clone (full checkout)"
else
  echo "  stacks/ excluded from the checkout"
fi

case "$target" in
  all) targets="claude pi opencode" ;;
  auto)
    targets=""
    for t in claude pi opencode; do
      command -v "$t" >/dev/null 2>&1 && targets="$targets $t"
    done
    ;;
  *) targets="$target" ;;
esac

if [ -z "${targets// /}" ]; then
  echo "no harness found on PATH. Re-run with: bash -s -- pi (or claude / opencode / all)" >&2
  exit 1
fi

for t in $targets; do
  echo
  echo "=== $t ==="
  bash "$dest/scripts/setup-$t.sh"
done

echo
echo "Bootstrap done:$targets. Repo at $dest — re-run scripts/setup-<harness>.sh to update."
