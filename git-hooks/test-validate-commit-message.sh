#!/usr/bin/env bash
# Regression tests for validate-commit-message.sh.
# Run: bash git-hooks/test-validate-commit-message.sh
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=validate-commit-message.sh
source "$HOOK_DIR/validate-commit-message.sh"

pass=0
fail=0

check() {
  local expected="$1" subject="$2" body="${3:-}"
  local msg_file
  msg_file="$(mktemp)"
  printf '%s\n' "$subject" > "$msg_file"
  [ -n "$body" ] && printf '\n%s\n' "$body" >> "$msg_file"

  local actual="allow"
  validate_commit_message_file "$msg_file" "test" >/dev/null 2>&1 || actual="block"
  rm -f "$msg_file"

  if [ "$actual" = "$expected" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FALHOU: esperado $expected, obtido $actual" >&2
    echo "        assunto: $subject" >&2
  fi
}

# --- Attribution must be blocked (rules/git.md §4.1 and §4.2) ---
check block 'feat: dashboard feito com Claude'
check block 'feat: dashboard feito com IA'
check block 'feat: relatorio gerado por IA'
check block 'fix: remover trailer gerado pelo Cursor'
check block 'chore(git): proibir Co-authored-by de agentes'
check block 'feat: parser written by an LLM'
check block 'feat: module created with AI'
check block 'feat: novo endpoint' 'Co-Authored-By: Someone <someone@example.com>'
check block 'feat: novo endpoint' 'Generated with some tool'

# --- Naming a tool or a domain term as the OBJECT must be allowed ---
# Regression: the generic pattern used to match the bare words "ia"/"ai"/"agente", which blocked
# honest subjects in any repo whose domain IS agents. See rules/git.md §4.2.
check allow 'docs(research): add ABNT norms and AI writing markers reference'
check allow 'feat: suporte a agentes de IA'
check allow 'feat(agents): add supervisor routing'
check allow 'fix: openai client'
check allow 'feat(skills): extend autoreview to Cursor and Pi'
check allow 'refactor: simplify agente de suporte'
check allow 'docs: comparar arquitetura multi-agente e agente unico'
check allow 'feat: integracao com IA generativa'
check allow 'chore: bump gemini adapter version'

# --- Conventional Commits format (rules/git.md §2) ---
check block 'Update SKILL.md'
check block 'remove(skills): drop shape skill'
check block 'revert: restore references in CLAUDE.md'
check block 'feat:missing space'
check block 'feat(): empty scope'
check block 'feat: subject ending in a period.'
check block "feat(skills): $(printf 'x%.0s' {1..59})"
check allow "feat(skills): $(printf 'x%.0s' {1..58})"
# 72 characters but more bytes: the limit counts characters.
check allow "docs: atualizar instruções de integração e validação $(printf 'x%.0s' {1..19})"
check block "docs: atualizar instruções de integração e validação $(printf 'x%.0s' {1..20})"
# A CRLF message file leaves \r on the subject under Linux bash; it is not part of the 72.
# Git Bash drops \r from command substitution, so only Linux (CI) exercises this case.
printf -v crlf_subject 'fix: %067d\r' 0
check allow "${crlf_subject//0/x}"
check allow 'feat(api)!: drop the v1 endpoints'
check allow 'Merge pull request #160 from YuukiFST/docs/159-readme-yuu-mode'
check allow "Merge branch 'main' into feat/42-dashboard"
check allow 'Revert "feat: dashboard de consumo"'
check allow 'Reapply "feat: dashboard de consumo"'
check block 'Merge fixes for the dashboard.'
check allow "$(printf '# commit.template comment\n\nfeat: subject below a comment')"
check allow 'fixup! feat: dashboard de consumo'

echo "ok: $pass | falhas: $fail"
[ "$fail" -eq 0 ]
