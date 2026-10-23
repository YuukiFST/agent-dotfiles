#!/usr/bin/env bash
# Regression test for sync-config.sh opencode: OpenCode V2 ignores metadata.opencode/slash, so
# every user-invoked skill has to reach ~/.config/opencode/commands as a generated slash command.
# Also pins the generator's two boundaries: a hand-written command survives, and a file it wrote
# for a skill that no longer exists is pruned.
# Run: bash scripts/test-sync-opencode.sh
set -uo pipefail

SYNC="$(cd "$(dirname "$0")" && pwd)/sync-config.sh"
REPO="$(dirname "$(dirname "$SYNC")")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

home="$WORK/home"
commands="$home/.config/opencode/commands"
export XDG_CONFIG_HOME="$home/.config"

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}

# State an earlier sync left behind, plus one command the user wrote by hand.
mkdir -p "$commands"
printf -- '---\ndescription: mine\n---\n\nkeep me\n' > "$commands/mine.md"
printf -- '---\n# agent-dotfiles: generated from skills/gone/SKILL.md by sync-config; edit the skill, not this file\ndescription: stale\n---\n\nstale\n' > "$commands/gone.md"

expect "sync run 1 exits 0" env HOME="$home" bash "$SYNC" opencode
hash_after_first="$(cat "$commands"/*.md | sha1sum)"
expect "sync run 2 exits 0" env HOME="$home" bash "$SYNC" opencode
expect "a second sync rewrites nothing" test "$hash_after_first" = "$(cat "$commands"/*.md | sha1sum)"

# The count comes from the repo, so enabling or dropping a user-invoked skill moves the
# expectation with it instead of leaving a hardcoded number to maintain.
user_invoked="$(grep -l 'opencode/autoinvoke: "false"' "$REPO"/skills/*/SKILL.md | wc -l)"
generated="$(find "$commands" -maxdepth 1 -name '*.md' ! -name 'mine.md' | wc -l)"
expect "one command per user-invoked skill ($user_invoked)" test "$generated" -eq "$user_invoked"

expect "yuu-mode gets a command" test -f "$commands/yuu-mode.md"
expect "the command carries the repo marker" grep -q '^# agent-dotfiles: generated from skills/yuu-mode/SKILL.md by sync-config' "$commands/yuu-mode.md"
expect "the description comes from the skill frontmatter" grep -q '^description: .' "$commands/yuu-mode.md"
expect "the body loads the skill by id" grep -q 'Load the `yuu-mode` skill with the skill tool' "$commands/yuu-mode.md"
# shellcheck disable=SC2016 # $ARGUMENTS is OpenCode's placeholder, expanded by OpenCode, not by the shell
expect "the body forwards the arguments" grep -q '^\$ARGUMENTS$' "$commands/yuu-mode.md"

expect "the hand-written command survives" test -f "$commands/mine.md"
expect "a generated command for a missing skill is pruned" test ! -e "$commands/gone.md"
expect "AGENTS.md still lands" cmp -s "$REPO/GLOBAL.md" "$home/.config/opencode/AGENTS.md"

[ "$fail" -eq 0 ]
