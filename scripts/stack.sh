#!/usr/bin/env bash
# Enable or disable an archived stack under stacks/<name>/.
# Layout of a stack (every directory optional):
#   stacks/<name>/skills/  -> skills/
#   stacks/<name>/rules/   -> rules/
#   stacks/<name>/root/    -> repo root
#   stacks/<name>/CLAUDE-snippet.md -> paste into CLAUDE.md by hand
# Usage: stack.sh enable|disable <name>
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
action="${1:?usage: stack.sh enable|disable <name>}"
name="${2:?usage: stack.sh enable|disable <name>}"
stack="$repo/stacks/$name"

[ -d "$stack" ] || { echo "no such stack: stacks/$name" >&2; exit 1; }

# enable copies instead of moving: the archive stays the inventory of what
# belongs to the stack, which is what disable walks to find the live copies.
copy_entries() { # $1 = source dir, $2 = dest dir - top-level entries only
  local src="$1" dest="$2" entry base
  [ -d "$src" ] || return 0
  mkdir -p "$dest"
  for entry in "$src"/*; do
    [ -e "$entry" ] || continue
    base="$(basename "$entry")"
    rm -rf "${dest:?}/$base"
    cp -r "$entry" "$dest/$base"
  done
}

case "$action" in
  enable)
    copy_entries "$stack/skills" "$repo/skills"
    copy_entries "$stack/rules" "$repo/rules"
    copy_entries "$stack/root" "$repo"
    echo "Stack '$name' is active. Paste stacks/$name/CLAUDE-snippet.md into CLAUDE.md, then run: bash scripts/sync-config.sh <harness>"
    ;;
  disable)
    for kind in skills rules root; do
      case "$kind" in
        skills) live="$repo/skills" ;;
        rules)  live="$repo/rules" ;;
        root)   live="$repo" ;;
      esac
      [ -d "$stack/$kind" ] || continue
      for entry in "$stack/$kind"/*; do
        [ -e "$entry" ] || continue
        base="$(basename "$entry")"
        [ -e "$live/$base" ] || continue
        rm -rf "${stack:?}/$kind/$base"
        mv "$live/$base" "$stack/$kind/$base"  # live copy wins: it may carry edits
      done
    done
    echo "Stack '$name' archived in stacks/$name. Remove its CLAUDE-snippet lines from CLAUDE.md, then run: bash scripts/sync-config.sh <harness>"
    ;;
  *)
    echo "usage: stack.sh enable|disable <name>" >&2
    exit 1
    ;;
esac
