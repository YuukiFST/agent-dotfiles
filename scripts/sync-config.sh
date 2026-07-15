#!/usr/bin/env bash
# Copy config (CLAUDE.md, dreaming.md, skills/, rules/) from this repo into harness dirs.
# Shared by setup-* and update-* so "git pull + update" always propagates config.
# Usage: sync-config.sh claude|opencode
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?usage: sync-config.sh claude|opencode}"

sync_skills() { # $1 = dest skills dir — per-skill replace: prunes files removed/renamed
  mkdir -p "$1"  # inside a repo skill, but keeps skills that exist only locally
  for s in "$repo"/skills/*/; do
    name="$(basename "$s")"
    rm -rf "${1:?}/$name"
    cp -r "$s" "$1/$name"
  done
}

sync_rules() { # $1 = dest rules dir — full mirror: rules/ is entirely repo-owned
  rm -rf "${1:?}"
  mkdir -p "$1"
  cp -r "$repo/rules/." "$1/"
}

case "$target" in
  claude)
    claude="$HOME/.claude"
    mkdir -p "$claude"
    cp "$repo/CLAUDE.md" "$claude/CLAUDE.md"
    cp "$repo/dreaming.md" "$claude/dreaming.md"
    sync_skills "$claude/skills"
    sync_rules "$claude/rules"
    # OpenCode companion copies (kept for cross-harness rule references)
    cfg="$HOME/.config/opencode"
    mkdir -p "$cfg"
    cp "$repo/CLAUDE.md" "$cfg/CLAUDE.md"
    cp "$repo/dreaming.md" "$cfg/dreaming.md"
    sync_rules "$cfg/rules"
    ;;
  opencode)
    cfg="$HOME/.config/opencode"
    mkdir -p "$cfg"
    cp "$repo/opencode.jsonc" "$cfg/opencode.jsonc"
    cp "$repo/CLAUDE.md" "$cfg/CLAUDE.md"
    cp "$repo/dreaming.md" "$cfg/dreaming.md"
    sync_skills "$cfg/skills"
    sync_rules "$cfg/rules"
    ;;
  *)
    echo "unknown target: $target" >&2; exit 1 ;;
esac

echo "Config synced ($target)."
