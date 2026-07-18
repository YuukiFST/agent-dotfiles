#!/usr/bin/env bash
# Copy config (CLAUDE.md, dreaming.md, skills/, rules/) from this repo into harness dirs.
# Shared by setup-* and update-* so "git pull + update" always propagates config.
# Usage: sync-config.sh claude|opencode|cursor|pi
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?usage: sync-config.sh claude|opencode|cursor|pi}"

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

# Every harness shares these. Runs for all targets so the NixOS box (Cursor + pi +
# OpenCode side by side) converges on the same config no matter which script ran.
sync_shared() {
  # rules/ live at ~/.claude/rules on EVERY harness — CLAUDE.md's conditional pointers
  # hardcode that path, so it must resolve even where Claude Code is not installed.
  sync_rules "$HOME/.claude/rules"

  # ~/.agents/skills is read natively by both Cursor and pi — one dir, two agents.
  # (Cursor: cursor.com/docs/skills · pi: packages/coding-agent/docs/skills.md)
  sync_skills "$HOME/.agents/skills"

  # pi takes global instructions from ~/.pi/agent/AGENTS.md. Only write when installed,
  # so a Claude-Code-only box does not grow a stray ~/.pi.
  if command -v pi >/dev/null 2>&1; then
    mkdir -p "$HOME/.pi/agent"
    cp "$repo/CLAUDE.md" "$HOME/.pi/agent/AGENTS.md"
  fi

  # agent-browser config is per-MACHINE (~/.agent-browser), shared by every harness that
  # shells out to the CLI. Seed only — the live file may grow local state (encryption key,
  # session sidecars) this repo does not track.
  if [ ! -f "$HOME/.agent-browser/config.json" ]; then
    mkdir -p "$HOME/.agent-browser/screenshots"
    if [ -e /etc/NIXOS ]; then src="$repo/agent-browser/config.nixos.json"
    else src="$repo/agent-browser/config.base.json"; fi
    sed "s|~/|$HOME/|" "$src" > "$HOME/.agent-browser/config.json"
    echo "  seeded ~/.agent-browser/config.json ($(basename "$src"))"
  fi

  # show-shot renders agent screenshots inline in the terminal (kitty/wezterm/chafa).
  mkdir -p "$HOME/.local/bin"
  cp "$repo/agent-browser/show-shot" "$HOME/.local/bin/show-shot"
  chmod +x "$HOME/.local/bin/show-shot"
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
  pi)
    # Same story: sync_shared already wrote ~/.agents/skills and ~/.pi/agent/AGENTS.md.
    command -v pi >/dev/null 2>&1 || { echo "pi not on PATH — run setup-pi.sh first" >&2; exit 1; }
    sync_shared
    ext_src="$repo/pi-extensions/code-review-graph/index.ts"
    if [ -f "$ext_src" ]; then
      ext_dest="$HOME/.pi/agent/extensions/code-review-graph"
      mkdir -p "$ext_dest"
      cp "$ext_src" "$ext_dest/index.ts"
    fi
    ;;
  *)
    echo "unknown target: $target" >&2; exit 1 ;;
esac

echo "Config synced ($target)."
