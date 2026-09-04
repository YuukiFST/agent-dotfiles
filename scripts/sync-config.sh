#!/usr/bin/env bash
# Copy config (CLAUDE.md, skills/, rules/, plus any root payload an active stack adds)
# from this repo into harness dirs.
# Shared by setup-* and update-* so "git pull + update" always propagates config.
# Usage: sync-config.sh claude|cursor|pi|opencode
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?usage: sync-config.sh claude|cursor|pi|opencode}"

prune_stale_skills() { # $1 = dest skills dir — archived stacks + REMOVED.txt, no copy
  mkdir -p "$1"
  # Prune every archived stack so it does not stay in the live harness. A stack that
  # is enabled also has its skills in skills/ above, so it is skipped here.
  for archived in "$repo"/stacks/*/skills/*/; do
    [ -d "$archived" ] || continue
    name="$(basename "$archived")"
    if [ ! -d "$repo/skills/$name" ]; then
      rm -rf "${1:?}/$name"
    fi
  done
  # Skills deleted from the repo — see skills/REMOVED.txt for why the list has to exist.
  if [ -f "$repo/skills/REMOVED.txt" ]; then
    while IFS= read -r line; do
      name="${line%%#*}"
      name="${name// /}"
      name="${name//$'\t'/}"
      name="${name//$'\r'/}"
      [ -n "$name" ] || continue
      rm -rf "${1:?}/$name"
    done < "$repo/skills/REMOVED.txt"
  fi
}

sync_skills() { # $1 = dest skills dir — per-skill replace: prunes files removed/renamed
  mkdir -p "$1"  # inside a repo skill, but keeps skills that exist only locally
  for s in "$repo"/skills/*/; do
    name="$(basename "$s")"
    rm -rf "${1:?}/$name"
    cp -r "$s" "$1/$name"
  done
  prune_stale_skills "$1"
  # Plugin/extension-only skills — not vendored in skills/
  rm -rf "${1:?}/caveman"
}

sync_rules() { # $1 = dest rules dir — full mirror: rules/ is entirely repo-owned
  rm -rf "${1:?}"
  mkdir -p "$1"
  cp -r "$repo/rules/." "$1/"
}

sync_pi_agent() {
  local pi_src="$repo/pi"
  local agent="$HOME/.pi/agent"
  [ -d "$pi_src" ] || return 0

  mkdir -p "$agent/extensions"
  for f in cloak.json package.json tsconfig.json models.json .gitignore; do
    if [ -f "$pi_src/$f" ]; then
      cp "$pi_src/$f" "$agent/$f"
    fi
  done

  python3 - "$pi_src/settings.json" "$agent/settings.json" <<'PY'
import json
import sys
from pathlib import Path

seed_path = Path(sys.argv[1])
live_path = Path(sys.argv[2])
seed = json.loads(seed_path.read_text())
fresh = not live_path.exists()
live: dict = {}
if live_path.exists():
    live = json.loads(live_path.read_text())

# Repo-owned keys — always converge on sync.
for key in ("theme", "enabledModels"):
    if key in seed:
        live[key] = seed[key]

# Machine-specific keys — seed a fresh install only; never overwrite a live choice.
for key in ("defaultProvider", "defaultModel", "defaultThinkingLevel"):
    if key in seed and (fresh or key not in live):
        live[key] = seed[key]

packages: list = []
seen: set[str] = set()
for pkg in seed.get("packages", []):
    key = pkg if isinstance(pkg, str) else pkg["source"]
    if key in seen:
        continue
    seen.add(key)
    packages.append(pkg)
live["packages"] = packages

live_path.write_text(json.dumps(live, indent=2) + "\n")
PY

  for ext in "$pi_src"/extensions/*/; do
    [ -d "$ext" ] || continue
    name="$(basename "$ext")"
    mkdir -p "$agent/extensions/$name"
    cp -r "$ext/." "$agent/extensions/$name/"
  done

  # settings.json packages only — never installs archived stacks/ (see stacks/README.md).
  if command -v pi >/dev/null 2>&1; then
    for pkg in $(python3 - "$pi_src/settings.json" <<'PY'
import json
import sys
from pathlib import Path

for pkg in json.loads(Path(sys.argv[1]).read_text()).get("packages", []):
    print(pkg if isinstance(pkg, str) else pkg["source"])
PY
); do
      pi install "$pkg" >/dev/null 2>&1 || pi install "$pkg" || true
    done
  fi
}

# ~/.config/opencode — OpenCode reads AGENTS.md there globally (opencode.ai/docs/rules).
# Skills need no copy: OpenCode already loads ~/.agents/skills, written by sync_shared.
# opencode.json is left alone — it holds per-machine MCP/provider state this repo does not track.
sync_opencode() {
  local oc="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
  mkdir -p "$oc"
  # A hand-maintained AGENTS.md predates this sync path on machines configured by hand —
  # keep one copy of it instead of dropping it silently.
  if [ -f "$oc/AGENTS.md" ] && [ ! -f "$oc/AGENTS.local.md.bak" ] &&
     ! cmp -s "$oc/AGENTS.md" "$repo/CLAUDE.md"; then
    cp "$oc/AGENTS.md" "$oc/AGENTS.local.md.bak"
    echo "  kept the previous hand-written AGENTS.md as AGENTS.local.md.bak"
  fi
  cp "$repo/CLAUDE.md" "$oc/AGENTS.md"
}

# Every harness shares these. Runs for all targets so the NixOS box (Cursor + pi
# side by side) converges on the same config no matter which script ran.
sync_shared() {
  # rules/ live at ~/.claude/rules on EVERY harness — CLAUDE.md's conditional pointers
  # hardcode that path, so it must resolve even where Claude Code is not installed.
  sync_rules "$HOME/.claude/rules"

  # ~/.agents/skills is read natively by both Cursor and pi — one dir, two agents.
  # (Cursor: cursor.com/docs/skills · pi: packages/coding-agent/docs/skills.md)
  sync_skills "$HOME/.agents/skills"

  # pi/Cursor boxes often never run sync-config claude; ~/.claude/skills can still hold
  # archived stack copies (effect, frontend pipeline, prove). Prune only — no mirror.
  if [ -d "$HOME/.claude/skills" ]; then
    prune_stale_skills "$HOME/.claude/skills"
  fi

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

  # Global git hooks (pre-push blocks AI attribution trailers; commit-msg is early feedback).
  bash "$repo/scripts/install-global-git-hooks.sh" >/dev/null
  install -m 755 "$repo/scripts/git-safe-commit.sh" "$HOME/.local/bin/git-safe-commit"
}

case "$target" in
  claude)
    claude="$HOME/.claude"
    mkdir -p "$claude"
    cp "$repo/CLAUDE.md" "$claude/CLAUDE.md"
    # dreaming.md ships with the memory stack (stacks/memory/root/): present only
    # while that stack is enabled, so a stale copy has to go when it is not.
    if [ -f "$repo/dreaming.md" ]; then
      cp "$repo/dreaming.md" "$claude/dreaming.md"
    else
      rm -f "$claude/dreaming.md"
    fi
    sync_skills "$claude/skills"
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
    sync_pi_agent
    ;;
  opencode)
    # Same story: sync_shared already wrote ~/.agents/skills, which OpenCode reads natively.
    sync_shared
    sync_opencode
    ;;
  *)
    echo "unknown target: $target" >&2; exit 1 ;;
esac

echo "Config synced ($target)."
