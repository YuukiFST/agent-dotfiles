#!/usr/bin/env bash
# sync-config.sh replaces each skill and rules/ through a staging copy and a rename,
# so a copy that fails halfway (interrupted run, locked file) leaves the live dir intact.
# A stub cp on PATH fails on the source named by FAIL_CP; every other command is real.
# Run: bash scripts/test-sync-replace-on-failure.sh
set -uo pipefail

SYNC="$(cd "$(dirname "$0")" && pwd)/sync-config.sh"
REPO="$(dirname "$SYNC")/.."
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

home="$WORK/home"
stub_bin="$WORK/bin"
skills="$home/.agents/skills"
rules="$home/.claude/rules"
mkdir -p "$skills/grilling" "$rules" "$stub_bin"
printf 'previous sync\n' > "$skills/grilling/SKILL.md"
printf 'previous sync\n' > "$rules/git.md"

real_cp="$(command -v cp)"
cat > "$stub_bin/cp" <<EOF
#!/bin/sh
for arg in "\$@"; do
  case "\${FAIL_CP:-}:\$arg" in
    grilling:*/skills/grilling|grilling:*/skills/grilling/|rules:*/rules|rules:*/rules/|rules:*/rules/.)
      echo "cp: simulated failure on \$arg" >&2; exit 1 ;;
  esac
done
exec "$real_cp" "\$@"
EOF
# rtk config would name a path outside this HOME (%APPDATA% on Windows).
printf '#!/bin/sh\necho "Config: %s/rtk/config.toml"\n' "$home" > "$stub_bin/rtk"
chmod +x "$stub_bin/cp" "$stub_bin/rtk"

sync() { # sync [VAR=value...] - runs sync-config.sh opencode inside the temporary HOME
  env -u GIT_CONFIG_GLOBAL HOME="$home" XDG_CONFIG_HOME="$home/.config" PATH="$stub_bin:$PATH" "$@" \
    bash "$SYNC" opencode >/dev/null 2>&1
}
fails() { ! "$@"; }
no_staging_in() { ! ls -A "$1" | grep -q sync; }

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}

expect "sync whose rules/ copy fails exits non-zero" fails sync FAIL_CP=rules
expect "rules/ keeps its previous files" grep -q 'previous sync' "$rules/git.md"
expect "sync whose skill copy fails exits non-zero" fails sync FAIL_CP=grilling
expect "the skill keeps its previous files" grep -q 'previous sync' "$skills/grilling/SKILL.md"
expect "sync without failures exits 0" sync
expect "rules/ converges on the repo copy" cmp -s "$REPO/rules/git.md" "$rules/git.md"
expect "the skill converges on the repo copy" cmp -s "$REPO/skills/grilling/SKILL.md" "$skills/grilling/SKILL.md"
expect "no staging dir left among the skills" no_staging_in "$skills"
expect "no staging dir left in ~/.claude" no_staging_in "$home/.claude"
expect "no staging dir left in ~/.agents" no_staging_in "$home/.agents"

[ "$fail" -eq 0 ]
