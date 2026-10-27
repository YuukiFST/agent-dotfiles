#!/usr/bin/env bash
# End-to-end tests for check-upstreams.sh against a stub gh that serves canned
# `gh api` output per endpoint, so no network or token is needed.
# Run: bash scripts/test-check-upstreams.sh
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/check-upstreams.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin" "$WORK/api" "$WORK/skills/current" "$WORK/skills/moved" "$WORK/skills/whole"
cat > "$WORK/bin/gh" <<'EOF'
#!/usr/bin/env bash
# gh api [--paginate] <endpoint> --jq <filter>: print the endpoint's fixture, or fail like a 404.
[ "$2" = --paginate ] && endpoint="$3" || endpoint="$2"
fixture="$FAKE_GH_API/$(printf '%s' "$endpoint" | tr -c 'A-Za-z0-9' _)"
[ -f "$fixture" ] && { cat "$fixture"; exit 0; }
echo "gh: Not Found (HTTP 404)" >&2
exit 1
EOF
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH" FAKE_GH_API="$WORK/api" UPSTREAMS_FILE="$WORK/skills/UPSTREAMS.tsv"

serve() { # $1 = endpoint; body from stdin
  cat > "$FAKE_GH_API/$(printf '%s' "$1" | tr -c 'A-Za-z0-9' _)"
}
serve 'repos/o/current/commits/aaaaaaa' <<<'2026-10-01T00:00:00Z'
serve 'repos/o/current/commits?since=2026-10-01T00:00:00Z&per_page=100&path=skills/current' </dev/null
serve 'repos/o/moved/commits/bbbbbbb' <<<'2026-09-01T00:00:00Z'
serve 'repos/o/moved/commits?since=2026-09-01T00:00:00Z&per_page=100&path=skills/moved' <<'EOF'
ccccccc 2026-10-20 fix: see #12, thanks @someone for `foo`
ddddddd 2026-09-15 feat: first change
EOF
serve 'repos/o/whole/commits/eeeeeee' <<<'2026-08-01T00:00:00Z'
for n in $(seq 1 12); do printf '%07d 2026-08-%02d change %s\n' "$n" "$n" "$n"; done \
  | serve 'repos/o/whole/commits?since=2026-08-01T00:00:00Z&per_page=100'

pass=0
fail=0

# expect <case> <exit> [check-upstreams args]: golden output from stdin.
expect() {
  local case="$1" want_exit="$2"; shift 2
  local got got_exit=0
  got="$(bash "$CHECK" "$@" 2>&1)" || got_exit=$?
  if [ "$got_exit" = "$want_exit" ] && diff <(cat) <(printf '%s\n' "$got") >"$WORK/diff"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $case (exit $got_exit, want $want_exit)" >&2
    cat "$WORK/diff" >&2
  fi
}

printf '%s\n' '# comment' '' \
  $'current\to/current\tskills/current\taaaaaaa\r' \
  $'moved\to/moved\tskills/moved\tbbbbbbb' \
  $'whole\to/whole\t.\teeeeeee' > "$UPSTREAMS_FILE"

expect current-only 0 current <<'EOF'
0 of 1 upstream sources changed past their pin, 0 could not be checked.
EOF

expect changed-text 2 current moved <<'EOF'
CHANGED  moved  o/moved skills/moved: 2 commits past bbbbbbb, latest ccccccc (2026-10-20)
  https://github.com/o/moved/compare/bbbbbbb...ccccccc
    ccccccc 2026-10-20 fix: see #12, thanks @someone for `foo`
    ddddddd 2026-09-15 feat: first change
1 of 2 upstream sources changed past their pin, 0 could not be checked.
EOF

# A subject's #12 and @someone stay inside a code span, so the drift issue neither
# links this repo's issue 12 nor pings the user.
expect changed-markdown-no-links 2 --markdown moved <<'EOF'
## moved: `o/moved` `skills/moved`

2 commits past `bbbbbbb`, latest `ccccccc` (2026-10-20). [Compare](https://github.com/o/moved/compare/bbbbbbb...ccccccc)

- `ccccccc 2026-10-20 fix: see #12, thanks @someone for 'foo'`
- `ddddddd 2026-09-15 feat: first change`

1 of 1 upstream sources changed past their pin, 0 could not be checked.
EOF

expect whole-repo-truncated 2 whole <<'EOF'
CHANGED  whole  o/whole .: 12 commits past eeeeeee, latest 0000001 (2026-08-01)
  https://github.com/o/whole/compare/eeeeeee...0000001
    0000001 2026-08-01 change 1
    0000002 2026-08-02 change 2
    0000003 2026-08-03 change 3
    0000004 2026-08-04 change 4
    0000005 2026-08-05 change 5
    0000006 2026-08-06 change 6
    0000007 2026-08-07 change 7
    0000008 2026-08-08 change 8
    0000009 2026-08-09 change 9
    0000010 2026-08-10 change 10
    2 more
1 of 1 upstream sources changed past their pin, 0 could not be checked.
EOF

printf '%s\n' $'gone\to/current\tskills/current\taaaaaaa' $'current\to/current\tskills/current\tfffffff' \
  $'current\to/current' > "$UPSTREAMS_FILE"
expect errors-win 1 <<'EOF'
ERROR    gone  o/current:skills/current: no skills/gone directory; fix or drop the row
ERROR    current  o/current:skills/current: pin fffffff not found upstream: gh: Not Found (HTTP 404)
ERROR    current  o/current:: row needs 4 tab-separated columns
0 of 3 upstream sources changed past their pin, 3 could not be checked.
EOF

# Targets beyond skills: a ./path in this repo (checked for existence), a downstream
# GitHub repo (nothing local to check), and an optional 5th column naming the branch.
mkdir -p "$WORK/present"
serve 'repos/o/rel/commits/fffffff' <<<'2026-07-01T00:00:00Z'
serve 'repos/o/rel/commits?since=2026-07-01T00:00:00Z&per_page=100&path=CHANGELOG.md&sha=master' \
  <<<'1111111 2026-07-09 chore(master): release 2.0.0'
printf '%s\n' $'./present\to/current\tskills/current\taaaaaaa' $'./absent\to/current\tskills/current\taaaaaaa' \
  $'o/downstream\to/current\tskills/current\taaaaaaa' $'./present\to/rel\tCHANGELOG.md\tfffffff\tmaster\r' \
  > "$UPSTREAMS_FILE"
expect targets-beyond-skills 1 <<'EOF'
ERROR    ./absent  o/current:skills/current: no ./absent in this repo; fix or drop the row
CHANGED  ./present  o/rel CHANGELOG.md: 1 commits past fffffff, latest 1111111 (2026-07-09)
  https://github.com/o/rel/compare/fffffff...1111111
    1111111 2026-07-09 chore(master): release 2.0.0
1 of 4 upstream sources changed past their pin, 1 could not be checked.
EOF

expect no-match 0 nosuchskill <<'EOF'
No row matched: nosuchskill.
EOF

echo "check-upstreams: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
