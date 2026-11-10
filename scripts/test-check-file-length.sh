#!/usr/bin/env bash
# End-to-end tests for scripts/check-file-length.mjs, run against a fixture git repo.
# Run: bash scripts/test-check-file-length.sh
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/check-file-length.mjs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
REPO="$WORK/repo"

pass=0
fail=0
# expect <case> <exit code> <regex the output must match> [--update]
expect() {
  local case="$1" want_code="$2" pattern="$3"
  shift 3
  local out code
  out="$(cd "$REPO" && git add -A && node scripts/check-file-length.mjs "$@" 2>&1)"
  code=$?
  if [ "$code" = "$want_code" ] && printf '%s\n' "$out" | grep -Eq -- "$pattern"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAILED: %s (want exit %s matching /%s/, got exit %s)\n%s\n' "$case" "$want_code" "$pattern" "$code" "$out" >&2
  fi
}
lines() { seq 1 "$1"; } # lines <n> - prints n lines

mkdir -p "$REPO/scripts" "$REPO/skills/vendored" "$REPO/skills/local" "$REPO/third/party" "$REPO/src"
cp "$CHECK" "$REPO/scripts/"
git -C "$REPO" init -q
git -C "$REPO" config core.autocrlf false
printf '# comment\nvendored\towner/repo\t.\tabc1234\n./third\towner/other\t.\tabc1234\n./skills\towner/collection\tskills\tabc1234\nowner/downstream\towner/repo\tsrc\tabc1234\n' > "$REPO/skills/UPSTREAMS.tsv"
printf '# header kept by --update\nsrc/big.js\t600\n' > "$REPO/scripts/file-length-baseline.tsv"
lines 600 > "$REPO/src/big.js"
lines 500 > "$REPO/src/at-limit.js"
lines 900 > "$REPO/skills/vendored/huge.mjs"
lines 900 > "$REPO/third/party/huge.js"
lines 900 > "$REPO/src/package-lock.json"
printf 'a\0b\n' > "$REPO/src/blob.bin"

expect clean 0 '0 problem\(s\)'
lines 501 > "$REPO/skills/local/new.md"
expect new-file-over-limit 1 '^skills/local/new.md: 501 lines, over the 500-line limit'
rm "$REPO/skills/local/new.md"
lines 601 > "$REPO/src/big.js"
expect listed-file-grows 1 '^src/big.js: grew to 601 lines, past its recorded 600'
expect update-refuses-growth 1 'not updating' --update
lines 550 > "$REPO/src/big.js"
expect listed-file-shrinks 1 '^src/big.js: shrank to 550 lines; lower its count'
expect update-lowers 0 '1 file\(s\) over 500' --update
expect update-wrote-count 0 '0 problem\(s\)'
grep -q '^# header kept by --update$' "$REPO/scripts/file-length-baseline.tsv" && grep -q "^src/big.js	550$" "$REPO/scripts/file-length-baseline.tsv" \
  && pass=$((pass + 1)) || { fail=$((fail + 1)); echo "FAILED: update-keeps-header-and-count" >&2; }
lines 400 > "$REPO/src/big.js"
expect update-drops-file-under-limit 0 '0 file\(s\) over 500' --update
lines 501 > "$REPO/src/big.js"
expect dropped-file-cannot-regrow 1 '^src/big.js: 501 lines, over the 500-line limit'

echo "check-file-length: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
