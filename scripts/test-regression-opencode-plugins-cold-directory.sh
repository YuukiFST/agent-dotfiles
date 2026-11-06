#!/usr/bin/env bash
# E2E regression test for scripts/opencode-plugins.mjs against a stub `opencode` that behaves like
# the real service in a directory it has not loaded: the first calls answer with the TUI half only.
# Run: bash scripts/test-regression-opencode-plugins-cold-directory.sh
set -uo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir "$WORK/bin"
cat > "$WORK/bin/opencode" <<'STUB'
#!/usr/bin/env bash
calls="$(cat "$STUB_STATE/calls" 2>/dev/null || echo 0)"
echo $((calls + 1)) > "$STUB_STATE/calls"
goal=@prevalentware/opencode-goal-plugin
case "$1 $2" in
  "plugin list")
    if [ "$calls" -lt "$STUB_COLD_CALLS" ]; then
      printf 'ID  VERSION  SOURCE\n-   0.1.95   %s\n' "$goal"
    else
      printf 'ID                      VERSION  SOURCE\n'
      printf 'caveman                 d9253c7  github:YuukiFST/caveman-lean\n'
      printf 'local.goal-mode.server  0.1.95   %s\n' "$goal"
      printf 'ponytail-subagent       f91ed2a  github:YuukiFST/ponytail-subagent\n'
    fi
    ;;
  "plugin add")
    echo "add $3" >> "$STUB_STATE/log"
    echo "Plugin \"$3\" is already configured"
    ;;
  "plugin update")
    echo "update $3" >> "$STUB_STATE/log"
    if [ "$calls" -lt "$STUB_COLD_CALLS" ] && [ "$3" != "$goal" ]; then
      echo "Error: Plugin is not configured: $3" >&2
      exit 1
    fi
    [ "${STUB_UPDATE_FAILS:-}" != "$3" ] || { echo "Error: update failed: $3" >&2; exit 1; }
    echo "No plugin updates available"
    ;;
esac
STUB
printf '@bash "%%~dp0opencode" %%*\r\n' > "$WORK/bin/opencode.cmd"
chmod +x "$WORK/bin/opencode"
export PATH="$WORK/bin:$PATH" OPENCODE_PLUGINS_POLL_MS=0

cat > "$WORK/expected-log" <<'LOG'
add github:YuukiFST/caveman-lean
add github:YuukiFST/ponytail-subagent
add @prevalentware/opencode-goal-plugin
update github:YuukiFST/caveman-lean
update github:YuukiFST/ponytail-subagent
update @prevalentware/opencode-goal-plugin
LOG

fail=0
expect() { # expect <description> <command...>
  local what="$1"
  shift
  if "$@"; then echo "ok: $what"; else echo "FAILED: $what" >&2; fail=1; fi
}
contains() { grep -qF -- "$2" "$1"; }
not_contains() { ! grep -qF -- "$2" "$1"; }
run() { # run <cold calls> <args...>: fresh stub state, output in $WORK/out, exit code in $code
  STUB_STATE="$(mktemp -d "$WORK/state.XXXX")" STUB_COLD_CALLS="$1"
  export STUB_STATE STUB_COLD_CALLS
  shift
  node "$SCRIPTS/opencode-plugins.mjs" "$@" > "$WORK/out" 2>&1
  code=$?
}
calls() { cat "$STUB_STATE/calls"; }

# Reported: "`opencode plugin list` ... responde incompleto nas primeiras 1 ou 2 chamadas de um
# diretório novo. Só aparece `@prevalentware/opencode-goal-plugin`, com ID `-`."
run 2 wait
expect "cold directory: wait exits 0 with everything installed" test "$code" -eq 0
expect "cold directory: the final answer lists caveman" contains "$WORK/out" "caveman "
expect "cold directory: the final answer lists ponytail-subagent" contains "$WORK/out" "ponytail-subagent "
expect "cold directory: the final answer lists the goal plugin's server half" contains "$WORK/out" "local.goal-mode.server"
expect "cold directory: one complete answer is not enough, it must repeat" test "$(calls)" -eq 4

run 0 wait
expect "warm directory: wait exits 0" test "$code" -eq 0

run 1000 wait
expect "never settles: exits 1 instead of hanging" test "$code" -eq 1
expect "never settles: names the missing plugin" contains "$WORK/out" "github:YuukiFST/caveman-lean"
expect "never settles: stops at the attempt limit" test "$(calls)" -eq 60

# Reported: "`opencode plugin update github:YuukiFST/caveman-lean` falhou com `Plugin is not
# configured: github:YuukiFST/caveman-lean`, e o mesmo com `ponytail-subagent`."
run 2 install
expect "cold directory: install exits 0" test "$code" -eq 0
expect "cold directory: no plugin reported as not configured" not_contains "$WORK/out" "Plugin is not configured"
expect "cold directory: every plugin added then updated, in order" diff "$WORK/expected-log" "$STUB_STATE/log"

export STUB_UPDATE_FAILS=github:YuukiFST/ponytail-subagent
run 0 install
expect "failed update: install exits 1" test "$code" -eq 1
expect "failed update: the error reaches the caller" contains "$WORK/out" "update failed: github:YuukiFST/ponytail-subagent"
unset STUB_UPDATE_FAILS

[ "$fail" -eq 0 ] && echo "All opencode-plugins regression tests passed."
exit "$fail"
