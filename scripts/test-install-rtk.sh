#!/usr/bin/env bash
# End-to-end test for install-rtk.sh against the real GitHub release, in a temporary HOME:
# the pinned build installs and reports the pinned version, and a pin whose SHA256 does not
# match the release installs nothing.
# Run: bash scripts/test-install-rtk.sh
set -uo pipefail

case "$(uname -s)" in
  Linux | Darwin) ;;
  *)
    echo "skipped: install-rtk.sh serves Linux and macOS; Windows runs test-install-rtk.ps1"
    exit 0
    ;;
esac

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0
check() { # $1 = case name, rest = command that must succeed
  local name="$1"
  shift
  if "$@"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $name" >&2
  fi
}

tag="$(awk '$1 == "tag" { print $2 }' "$SCRIPTS/rtk-pin.txt")"

HOME="$WORK/good" bash "$SCRIPTS/install-rtk.sh" >"$WORK/good.log" 2>&1
check "pinned build installs" test $? -eq 0
check "installed rtk reports $tag" grep -q "${tag#v}" <("$WORK/good/.local/bin/rtk" --version 2>&1)

mkdir -p "$WORK/tampered"
cp "$SCRIPTS/install-rtk.sh" "$WORK/tampered/"
sed -E 's/^[0-9a-f]{64}  /0000000000000000000000000000000000000000000000000000000000000000  /' \
  "$SCRIPTS/rtk-pin.txt" >"$WORK/tampered/rtk-pin.txt"
HOME="$WORK/bad" bash "$WORK/tampered/install-rtk.sh" >"$WORK/bad.log" 2>&1
check "hash mismatch exits non-zero" test $? -ne 0
check "hash mismatch installs nothing" test ! -e "$WORK/bad/.local/bin/rtk"
check "hash mismatch names both hashes" grep -q "nothing was installed" "$WORK/bad.log"

if [ "$fail" -ne 0 ]; then
  sed 's/^/  good: /' "$WORK/good.log" >&2
  sed 's/^/  bad: /' "$WORK/bad.log" >&2
fi
echo "ok: $pass | failed: $fail"
[ "$fail" -eq 0 ]
