#!/usr/bin/env bash
# End-to-end tests for the pre-push hook: real pushes to a bare remote in a temp dir.
# Run: bash git-hooks/test-pre-push.sh
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0

expect() { # $1 = allow|block, $2 = case name, rest = push command run in the clone
  local expected="$1" name="$2" actual="allow"
  shift 2
  "$@" >"$WORK/push.log" 2>&1 || actual="block"
  if [ "$actual" = "$expected" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FALHOU: $name: esperado $expected, obtido $actual" >&2
    sed 's/^/        /' "$WORK/push.log" >&2
  fi
}

commit() { # $1 = message; --no-verify: the cases below need commits commit-msg would refuse
  git -c user.name=t -c user.email=t@example.com commit -q --allow-empty --no-verify -m "$1"
}

# Remote main holds a subject that is not Conventional Commits, as GitHub web edits are.
git init -q --bare --initial-branch=main "$WORK/remote.git"
git clone -q "$WORK/remote.git" "$WORK/seed" 2>/dev/null
(cd "$WORK/seed" && commit "Initial commit" && git push -q origin HEAD:main)

# A remote that is not named origin (upstream of a fork) must not put its commits in range.
git clone -q -o gh "$WORK/remote.git" "$WORK/clone"
cd "$WORK/clone" || exit 1
git config core.hooksPath "$HOOK_DIR"

git switch -q -c feat/1-new-branch
commit "feat: add x"
expect allow "branch nova, remote gh" git push gh feat/1-new-branch

# Someone else's non-CC commit lands on main and is merged into the pushed branch.
(cd "$WORK/seed" && commit "Update README.md" && git push -q origin HEAD:main)
git fetch -q gh
git -c user.name=t -c user.email=t@example.com merge -q --no-edit gh/main
expect allow "merge de main com commit alheio" git push gh feat/1-new-branch

commit "Add y"
expect block "commit proprio fora do padrao" git push gh feat/1-new-branch
git reset -q --hard HEAD~1

commit "$(printf 'feat: add z\n\nCo-authored-by: Bot <bot@example.com>')"
expect block "trailer de atribuicao" git push gh feat/1-new-branch
git reset -q --hard HEAD~1

# Force-push over a remote tip this clone never fetched: the hook still checks the push.
(cd "$WORK/seed" && git fetch -q origin && git switch -q -c feat/1-new-branch origin/feat/1-new-branch &&
  commit "feat: remote only" && git push -q origin feat/1-new-branch)
commit "Add w"
expect block "force-push sobre remote_sha desconhecido" git push --force gh feat/1-new-branch

echo "ok: $pass | falhas: $fail"
[ "$fail" -eq 0 ]
