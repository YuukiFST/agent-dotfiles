#!/usr/bin/env bash
# Regression tests for check-skill-frontmatter.sh.
# Run: bash scripts/test-check-skill-frontmatter.sh
set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/check-skill-frontmatter.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0

# check <allow|block> <case> <dir-name>: SKILL.md content comes from stdin.
check() {
  local expected="$1" case="$2" dir="$3"
  local root="$WORK/$case"
  mkdir -p "$root/$dir"
  cat > "$root/$dir/SKILL.md"

  local actual="allow"
  bash "$CHECK" "$root" >/dev/null 2>&1 || actual="block"

  if [ "$actual" = "$expected" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAILED: $case expected $expected, got $actual" >&2
    bash "$CHECK" "$root" >&2
  fi
}

long_desc="$(printf 'a%.0s' $(seq 1 1025))"

# --- Valid frontmatter must pass ---
check allow valid my-skill <<'EOF'
---
name: my-skill
description: Do one thing. Use when asked for that thing.
---
# Body
EOF
check allow quoted-colon my-skill <<'EOF'
---
name: my-skill
description: "Control a browser: navigate, click. Use when a page is needed."
---
EOF
check allow extra-fields my-skill <<'EOF'
---
name: my-skill
description: Do one thing.
user-invocable: false
author: Someone
---
EOF
check allow crlf my-skill < <(printf -- '---\r\nname: my-skill\r\ndescription: Do one thing.\r\n---\r\n')

# --- Broken frontmatter must be blocked ---
# PR #97: an unquoted ": " inside a plain scalar made the harness drop the description.
check block unquoted-colon my-skill <<'EOF'
---
name: my-skill
description: Build a UI with effects built in: everything the other skill does.
---
EOF
check block no-frontmatter my-skill <<'EOF'
# My skill
EOF
check block not-a-mapping my-skill <<'EOF'
---
just a sentence
---
EOF
check block missing-description my-skill <<'EOF'
---
name: my-skill
---
EOF
check block empty-description my-skill <<'EOF'
---
name: my-skill
description: ""
---
EOF
check block list-description my-skill <<'EOF'
---
name: my-skill
description:
  - one
---
EOF
check block long-description my-skill <<EOF
---
name: my-skill
description: $long_desc
---
EOF
check block missing-name my-skill <<'EOF'
---
description: Do one thing.
---
EOF
check block name-mismatch my-skill <<'EOF'
---
name: other-skill
description: Do one thing.
---
EOF
check block uppercase-name My-Skill <<'EOF'
---
name: My-Skill
description: Do one thing.
---
EOF
check block double-hyphen my--skill <<'EOF'
---
name: my--skill
description: Do one thing.
---
EOF
check block edge-hyphen my-skill- <<'EOF'
---
name: my-skill-
description: Do one thing.
---
EOF

echo "check-skill-frontmatter: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
