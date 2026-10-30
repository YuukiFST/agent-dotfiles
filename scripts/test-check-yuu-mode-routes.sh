#!/usr/bin/env bash
# Regression tests for check-yuu-mode-routes.sh.
# Run: bash scripts/test-check-yuu-mode-routes.sh
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/check-yuu-mode-routes.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0

# tree <case> <skill>...: a skills dir holding yuu-mode, a playbook and each named skill;
# yuu-mode's SKILL.md comes from stdin.
tree() {
  local root="$WORK/$1"
  shift
  mkdir -p "$root/yuu-mode/playbooks"
  cat > "$root/yuu-mode/SKILL.md"
  : > "$root/yuu-mode/playbooks/bug-fix.md"
  for skill in "$@"; do
    mkdir -p "$root/$skill"
    : > "$root/$skill/SKILL.md"
  done
}

# check <allow|block> <case>
check() {
  local expected="$1" case="$2" actual="allow"
  bash "$CHECK" "$WORK/$case" >/dev/null 2>&1 || actual="block"
  if [ "$actual" = "$expected" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $case expected $expected, got $actual" >&2
    bash "$CHECK" "$WORK/$case" >&2
  fi
}

# --- Every skill routed, every route resolves: pass ---
tree valid alpha principle-foo <<'EOF'
| Task | Route |
|------|-------|
| A defect | `playbooks/bug-fix.md` |
| Review a diff for `alpha` | `alpha` |
EOF
check allow valid

# --- The same router with CRLF line endings: pass ---
tree crlf alpha <<'EOF'
| Task | Route |
| Review | `alpha` |
| A defect | `playbooks/bug-fix.md` |
EOF
sed -i 's/$/\r/' "$WORK/crlf/yuu-mode/SKILL.md"
check allow crlf

# --- A route to a deleted skill: block ---
tree dead-skill alpha <<'EOF'
| Review | `alpha` |
| Gone | `gone` |
EOF
check block dead-skill

# --- A route to a missing playbook: block ---
tree dead-playbook alpha <<'EOF'
| Review | `alpha` |
| Perf | `playbooks/perf-issue.md` |
EOF
check block dead-playbook

# --- A skill with no route: block ---
tree unrouted alpha beta <<'EOF'
| Review | `alpha` |
EOF
check block unrouted

# --- A skill named only in the task cell is still unrouted: block ---
tree task-cell-only alpha beta <<'EOF'
| Review | `alpha` |
| Hand `beta` work to alpha | `alpha` |
EOF
check block task-cell-only

# --- A row without a trailing pipe still has its last cell checked: block ---
tree no-trailing-pipe alpha <<'EOF'
| Ask about `alpha` | `gone`
| Do it | `alpha` |
EOF
check block no-trailing-pipe

# --- An indented row is still a route row: block ---
tree indented alpha <<'EOF'
| Do it | `alpha` |
  | Indented | `gone` |
EOF
check block indented

# --- A playbook step naming a skill listed in REMOVED.txt: block ---
tree removed-in-playbook alpha <<'EOF'
| Do it | `alpha` |
| A defect | `playbooks/bug-fix.md` |
EOF
printf '# deleted skills\nold-skill  # merged into alpha\n' > "$WORK/removed-in-playbook/REMOVED.txt"
echo '2. Read `old-skill` before the fix.' > "$WORK/removed-in-playbook/yuu-mode/playbooks/bug-fix.md"
check block removed-in-playbook

# --- REMOVED.txt names nothing yuu-mode mentions: pass ---
tree removed-unmentioned alpha <<'EOF'
| Do it | `alpha` |
EOF
printf 'old-skill\n' > "$WORK/removed-unmentioned/REMOVED.txt"
check allow removed-unmentioned

# --- No yuu-mode router at all: block ---
mkdir -p "$WORK/no-router/alpha"
: > "$WORK/no-router/alpha/SKILL.md"
check block no-router

echo "check-yuu-mode-routes: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
