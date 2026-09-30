#!/usr/bin/env bash
# Regression tests for ai_tells_lint.py, plus the id consistency check.
# Run: bash skills/ai-tells/tests/run.sh            (diff against the golden files)
#      bash skills/ai-tells/tests/run.sh --update   (regenerate the golden files)
#
# Each fixtures/<name>.md has a fixtures/<name>.expected holding the exact lint output.
# clean.md is the false-positive guard: prose, code, URLs and tables that must stay silent.
set -uo pipefail
export PYTHONIOENCODING=utf-8

here="$(cd "$(dirname "$0")" && pwd)"
skill="$(dirname "$here")"
repo="$(cd "$skill/../.." && pwd)"
lint="$skill/scripts/ai_tells_lint.py"
py="$(command -v python3 || command -v python)"

pass=0
fail=0
report_fail() {
  fail=$((fail + 1))
  echo "FAILED: $1" >&2
}

cd "$here" || exit 2
for fixture in fixtures/*.md; do
  expected="${fixture%.md}.expected"
  actual="$("$py" "$lint" "$fixture")"
  status=$?
  actual="$(printf '%s' "$actual" | tr -d '\r')"
  # 0 = clean, 1 = findings; anything else is a crash that an empty golden file would hide.
  if [ "$status" -gt 1 ]; then
    report_fail "$fixture: lint exited $status"
    continue
  fi
  if [ "${1:-}" = "--update" ]; then
    printf '%s' "$actual" > "$expected"
    [ -n "$actual" ] && echo >> "$expected"
    continue
  fi
  if diff <(printf '%s\n' "$actual" | sed '/^$/d') <(sed '/^$/d' "$expected") >/dev/null; then
    pass=$((pass + 1))
  else
    report_fail "$fixture output differs from $expected"
    diff <(printf '%s\n' "$actual" | sed '/^$/d') <(sed '/^$/d' "$expected") >&2
  fi
done

# Stdin must decode as UTF-8 whatever the console encoding (cp1252 on Windows), or an em
# dash reads as curly quotes and the "rerun until no dash" check in SKILL.md passes falsely.
# The octal escapes are the UTF-8 bytes of an em dash.
actual="$(printf 'x \342\200\224 y\n' | env -u PYTHONIOENCODING "$py" "$lint" | tr -d '\r')"
if [ "$actual" = "$(printf '<stdin>:1:3: dash: "\342\200\224"')" ]; then
  pass=$((pass + 1))
else
  report_fail "stdin: expected a dash finding, got: $actual"
fi

# Every id the lint prints must be a heading in patterns.md, or a finding points nowhere.
while read -r id; do
  if grep -qx "### $id" "$skill/patterns.md"; then
    pass=$((pass + 1))
  else
    report_fail "lint rule '$id' has no '### $id' heading in patterns.md"
  fi
done < <("$py" "$lint" --list-rules | tr -d '\r')

# Other skills cite patterns as ai-tells#<id>; a renamed or removed id breaks them silently.
while IFS=: read -r file id; do
  if grep -qx "### $id" "$skill/patterns.md"; then
    pass=$((pass + 1))
  else
    report_fail "$file cites ai-tells#$id, which is not a heading in patterns.md"
  fi
done < <(grep -roE --include='*.md' 'ai-tells#[a-z0-9-]+' "$repo/skills" \
  | sed -E 's/:ai-tells#/:/' | sort -u)

[ "${1:-}" = "--update" ] && { echo "golden files regenerated"; exit 0; }
echo "passed: $pass, failed: $fail"
[ "$fail" -eq 0 ]
