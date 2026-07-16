#!/usr/bin/env bash
# Copy config (CLAUDE.md, dreaming.md, skills/, rules/) from this repo into harness dirs.
# Shared by setup-* and update-* so "git pull + update" always propagates config.
# Usage: sync-config.sh claude|opencode|cursor
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?usage: sync-config.sh claude|opencode|cursor}"

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

# Every harness shares these. Runs for all targets so one machine with several
# agents converges on the same config no matter which setup script ran.
sync_shared() {
  # rules/ live at ~/.claude/rules on EVERY harness — CLAUDE.md's conditional pointers
  # hardcode that path, so it must resolve even where Claude Code is not installed.
  sync_rules "$HOME/.claude/rules"

  # ~/.agents/skills is read natively by Cursor, pi and omp — one dir, three agents.
  # (Cursor: cursor.com/docs/skills · pi: docs/skills.md · omp: `agents` provider.)
  sync_skills "$HOME/.agents/skills"

  # pi and omp are different tools (omp is a fork of pi) with separate config roots.
  # Both take global instructions from <root>/AGENTS.md. Only write when installed.
  for pair in "pi:$HOME/.pi/agent" "omp:$HOME/.omp/agent"; do
    cmd="${pair%%:*}"; dir="${pair#*:}"
    command -v "$cmd" >/dev/null 2>&1 || continue
    mkdir -p "$dir"
    cp "$repo/CLAUDE.md" "$dir/AGENTS.md"
  done
}

case "$target" in
  claude)
    claude="$HOME/.claude"
    mkdir -p "$claude"
    cp "$repo/CLAUDE.md" "$claude/CLAUDE.md"
    cp "$repo/dreaming.md" "$claude/dreaming.md"
    sync_skills "$claude/skills"
    sync_shared
    ;;
  opencode)
    cfg="$HOME/.config/opencode"
    mkdir -p "$cfg"
    cp "$repo/opencode.jsonc" "$cfg/opencode.jsonc"
    # OpenCode reads ~/.config/opencode/AGENTS.md; a CLAUDE.md here is never read
    # (its only CLAUDE.md fallback is ~/.claude/CLAUDE.md). opencode.ai/docs/rules
    cp "$repo/CLAUDE.md" "$cfg/AGENTS.md"
    cp "$repo/dreaming.md" "$cfg/dreaming.md"
    sync_skills "$cfg/skills"
    sync_shared
    ;;
  cursor)
    # Everything Cursor can take from disk already comes from sync_shared: it reads
    # ~/.agents/skills natively, so a second copy under ~/.cursor/skills would only
    # duplicate every skill. Global rules are UI-only (Customize → Rules) and cannot
    # be synced at all — see README.
    sync_shared
    ;;
  *)
    echo "unknown target: $target" >&2; exit 1 ;;
esac

echo "Config synced ($target)."
