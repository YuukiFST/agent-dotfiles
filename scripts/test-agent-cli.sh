#!/usr/bin/env bash
# End-to-end tests for bin/agent-cli, run against a fixture repo and a fake home dir.
# Run: bash scripts/test-agent-cli.sh
set -uo pipefail

CLI="$(cd "$(dirname "$0")/.." && pwd)/bin/agent-cli"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
FAKE_HOME="$WORK/home"
# os.homedir() reads USERPROFILE on Windows and HOME elsewhere.
export HOME="$FAKE_HOME" USERPROFILE="$FAKE_HOME"
# drift reads the global core.hooksPath; keep every global read and write in the fixture.
export GIT_CONFIG_GLOBAL="$WORK/gitconfig"

pass=0
fail=0

# expect <case> <exit code> <regex the output must match> -- <agent-cli args...>
expect() {
  local case="$1" want_code="$2" pattern="$3"
  shift 4
  local out code
  out="$(node "$REPO/bin/agent-cli" "$@" 2>&1)"
  code=$?
  if [ "$code" = "$want_code" ] && printf '%s\n' "$out" | grep -Eq -- "$pattern"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf 'FAILED: %s (want exit %s matching /%s/, got exit %s)\n%s\n' "$case" "$want_code" "$pattern" "$code" "$out" >&2
  fi
}

# --- Fixture repo: the files agent-cli reads ---
mkdir -p "$REPO/bin" "$REPO/.github/workflows" "$REPO/rules" "$REPO/skills/alpha" "$REPO/skills/yuu-mode" "$REPO/hooks" "$REPO/mods/beta" "$REPO/git-hooks"
cp "$CLI" "$REPO/bin/agent-cli"
echo "rule" > "$REPO/rules/git.md"
echo "hook" > "$REPO/hooks/gate.js"
echo "mod" > "$REPO/mods/beta/index.js"
echo "gate" > "$REPO/git-hooks/commit-msg"
echo "hook test" > "$REPO/git-hooks/test-commit-msg.sh"
printf '__pycache__/\n' > "$REPO/.gitignore"
for f in CODING_STANDARDS.md PROMPT_ENGINEERING.md GLOBAL.md; do echo "$f" > "$REPO/$f"; done
cat > "$REPO/skills/alpha/SKILL.md" <<'EOF'
---
name: alpha
description: "Alpha does the thing. Run as /alpha."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---
# Alpha
EOF
cat > "$REPO/skills/yuu-mode/SKILL.md" <<'EOF'
---
name: yuu-mode
description: Router.
---
### Build

| Task | Route |
|------|-------|
| Do the alpha thing | `alpha` |
EOF
printf '# comment\nalpha\towner/repo\tskills/alpha\t0123456789abcdef\n' > "$REPO/skills/UPSTREAMS.tsv"
printf '# deleted skills\ngone  # merged into alpha\n' > "$REPO/skills/REMOVED.txt"
cat > "$REPO/.github/workflows/ci.yml" <<'EOF'
name: CI
on: [push]
jobs:
  ok:
    name: Passes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Say hi
        run: echo hi
      - name: Multi-line block
        run: |
          for i in 1 2; do
            echo "line $i"
          done
  broken:
    runs-on: ubuntu-latest
    steps:
      - name: First fails
        run: echo "boom happened" && exit 3
      - name: Never runs
        run: echo SHOULD-NOT-RUN
  needs-tool:
    runs-on: ubuntu-latest
    steps:
      - name: Uses a missing tool
        run: definitely-not-installed-xyz --check
  install-only:
    runs-on: ubuntu-latest
    steps:
      - name: Install
        run: sudo apt-get install -y valgrind
EOF

# --- Fake home synced the way sync-config.sh copies ---
sync_home() {
  rm -rf "$FAKE_HOME"
  mkdir -p "$FAKE_HOME/.claude/skills" "$FAKE_HOME/.agents/skills" "$FAKE_HOME/.claude/mods"
  cp -r "$REPO/rules" "$FAKE_HOME/.claude/rules"
  cp -r "$REPO/hooks" "$FAKE_HOME/.claude/hooks"
  cp -r "$REPO/mods/beta" "$FAKE_HOME/.claude/mods/beta"
  mkdir -p "$FAKE_HOME/.claude/git-hooks"
  cp "$REPO/git-hooks/commit-msg" "$FAKE_HOME/.claude/git-hooks/"
  git config --global core.hooksPath "$FAKE_HOME/.claude/git-hooks"
  cp "$REPO/CODING_STANDARDS.md" "$REPO/PROMPT_ENGINEERING.md" "$FAKE_HOME/.claude/"
  cp "$REPO/GLOBAL.md" "$FAKE_HOME/.claude/CLAUDE.md"
  for d in "$FAKE_HOME/.claude/skills" "$FAKE_HOME/.agents/skills"; do
    cp -r "$REPO/skills/alpha" "$REPO/skills/yuu-mode" "$d/"
  done
}

# --- help and usage ---
expect help 0 'check \[job\.\.\.\]' -- --help
expect no-args 2 'agent-cli <command>' --
expect unknown-command 2 'unknown command: nope' -- nope
expect check-help 0 'SKIP means' -- check --help

# --- check ---
expect check-list 0 '^broken: First fails \| Never runs$' -- check --list
expect check-drops-sudo 0 '^ok: ' -- check --list
expect check-all 1 '^summary: 1 pass, 1 fail, 1 skip' -- check
expect check-pass 0 '^PASS ok ' -- check ok
expect check-block-run 0 'summary: 1 pass' -- check ok
expect check-fail-tail 1 '^  boom happened$' -- check broken
expect check-fail-stops 1 'step "First fails" exit 3' -- check broken
expect check-skip 0 '^SKIP needs-tool: missing definitely-not-installed-xyz' -- check needs-tool
expect check-unknown-job 2 'unknown job: nope' -- check nope
expect check-json 1 '"fail": 1' -- check --json

# --- drift ---
expect state-not-repo 1 'not a git repo' -- state
# drift reads .gitignore through git, so the fixture becomes a repo (nothing committed yet).
git -C "$REPO" init -q -b work
git -C "$REPO" config core.autocrlf false
sync_home
# rules/ + 1 mod + core.hooksPath + 1 git hook (its test-*.sh is not live) + 3 files whose live
# dir exists (no ~/.pi, no ~/.config/opencode) + 1 hook + 2 skills x 2 dirs
expect drift-clean 0 '^summary: 0 drift in 12 targets' -- drift
# Regression (A/B run on a fresh worktree): a checkout with core.autocrlf=true differs from
# the live copy only in CR bytes, and byte compare reported ~100 false drifts.
sed -i 's/$/\r/' "$FAKE_HOME/.claude/skills/alpha/SKILL.md" "$FAKE_HOME/.claude/CLAUDE.md"
expect drift-crlf-only 0 '^summary: 0 drift' -- drift
# Regression (same run): a __pycache__ the sync copied from another checkout is not payload.
mkdir -p "$FAKE_HOME/.claude/skills/alpha/__pycache__"
echo "bytecode" > "$FAKE_HOME/.claude/skills/alpha/__pycache__/x.pyc"
expect drift-ignored-extra 0 '^summary: 0 drift' -- drift
echo "stray" > "$FAKE_HOME/.claude/skills/alpha/notes.md"
expect drift-skill-extra 1 '^DRIFT skills/alpha -> ~/.claude/skills: extra: notes.md$' -- drift
sync_home
echo "old hook" > "$FAKE_HOME/.claude/hooks/gate.js"
expect drift-hook 1 '^DRIFT hooks/gate.js -> ~/.claude/hooks/gate.js: differs$' -- drift
sync_home
# Regression: core.hooksPath on a checkout's git-hooks/ follows that checkout's branch and
# goes silent when the worktree is removed; the gate must run from ~/.claude/git-hooks.
git config --global core.hooksPath "$REPO/git-hooks"
expect drift-git-hooks-path 1 '^DRIFT git-hooks/ -> core.hooksPath: points at .*/git-hooks, not ~/.claude/git-hooks$' -- drift
sync_home
rm -rf "$FAKE_HOME/.claude/git-hooks"
expect drift-git-hook-missing 1 '^DRIFT git-hooks/commit-msg -> ~/.claude/git-hooks/commit-msg: not installed$' -- drift
sync_home
echo "old gate" > "$FAKE_HOME/.claude/git-hooks/commit-msg"
expect drift-git-hook-differs 1 '^DRIFT git-hooks/commit-msg -> ~/.claude/git-hooks/commit-msg: differs$' -- drift
sync_home
mkdir -p "$FAKE_HOME/.claude/mods/beta/.claude-plugin/types"
echo "generated" > "$FAKE_HOME/.claude/mods/beta/.claude-plugin/types/x.d.ts"
expect drift-mod-extra-ok 0 '^summary: 0 drift' -- drift
echo "old mod" > "$FAKE_HOME/.claude/mods/beta/index.js"
expect drift-mod-differs 1 '^DRIFT mods/beta -> ~/.claude/mods: differs: index.js$' -- drift
sync_home
echo "edited live" >> "$FAKE_HOME/.agents/skills/alpha/SKILL.md"
expect drift-skill-differs 1 '^DRIFT skills/alpha -> ~/.agents/skills: differs: SKILL.md$' -- drift
sync_home
echo "hand-written" > "$FAKE_HOME/.claude/rules/local.md"
expect drift-rules-extra 1 '^DRIFT rules/ -> ~/.claude/rules: extra: local.md$' -- drift
sync_home
mkdir -p "$FAKE_HOME/.claude/skills/gone"
expect drift-removed-live 1 '^DRIFT skills/gone -> ~/.claude/skills: in REMOVED.txt but still live$' -- drift
sync_home
echo "old" > "$FAKE_HOME/.claude/CLAUDE.md"
expect drift-global 1 '^DRIFT GLOBAL.md -> ~/.claude/CLAUDE.md: differs$' -- drift
sync_home
rm -rf "$FAKE_HOME/.claude/skills/alpha"
expect drift-not-installed 1 'skills/alpha -> ~/.claude/skills: not installed' -- drift

# --- skill ---
sync_home
expect skill-route 0 '^route: Build \| Do the alpha thing$' -- skill alpha
expect skill-invocation 0 '^invocation: user-only, opencode markers ok$' -- skill alpha
expect skill-upstream 0 '^upstream: owner/repo skills/alpha @0123456$' -- skill alpha
expect skill-live 0 '^live: ~/.claude/skills in sync; ~/.agents/skills in sync$' -- skill alpha
expect skill-unknown 1 'no skills/alp; did you mean: alpha' -- skill alp
expect skill-json 0 '"invocation": "user-only"' -- skill alpha --json

# --- state ---
git -C "$REPO" config user.name "Test User"
git -C "$REPO" config user.email "test@example.invalid"
git -C "$REPO" add -A
git -C "$REPO" -c commit.gpgsign=false commit -q -m "chore: seed fixture" --no-verify
expect state-clean 0 '^changed: clean$' -- state
expect state-identity 0 '^identity: Test User <test@example.invalid>$' -- state
expect state-branch 0 '^branch: work \(no upstream\)$' -- state
expect state-last 0 '^last: [0-9a-f]+ chore: seed fixture$' -- state
echo "new" > "$REPO/new.txt"
expect state-dirty 0 '^changed: 1 \(\?\? new.txt\)$' -- state
git -C "$REPO" config --unset user.email
GIT_CONFIG_GLOBAL="$WORK/empty-gitconfig" expect state-unset 0 '<UNSET>$' -- state
rm "$REPO/new.txt"

# --- behind origin/main: drift measured from a stale tree misleads ---
expect state-no-origin-main 0 '^behind origin/main: unknown \(no origin/main ref\)$' -- state
git -C "$REPO" update-ref refs/remotes/origin/main HEAD
expect state-even 0 '^behind origin/main: 0$' -- state
sync_home
expect drift-even-no-warning 0 '^summary: 0 drift' -- drift
if node "$REPO/bin/agent-cli" drift | grep -q WARNING; then fail=$((fail + 1)); echo "FAILED: drift-even-no-warning printed a WARNING" >&2; else pass=$((pass + 1)); fi
for n in 1 2; do
  git -C "$REPO" update-ref refs/remotes/origin/main "$(git -C "$REPO" -c user.email=test@example.invalid commit-tree "HEAD^{tree}" -p origin/main -m "upstream $n")"
done
expect state-behind 0 '^behind origin/main: 2$' -- state
expect drift-behind-warns 0 '^WARNING: this checkout is 2 commits behind origin/main' -- drift
expect state-behind-json 0 '"behindMain": 2' -- state --json

echo "agent-cli: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
