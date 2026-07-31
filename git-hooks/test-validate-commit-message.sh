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
check allow 'fix openai client'
check allow 'feat(skills): extend autoreview to Cursor and Pi'
check allow 'refactor: simplify agente de suporte'
check allow 'docs: comparar arquitetura multi-agente e agente unico'
check allow 'feat: integracao com IA generativa'
check allow 'chore: bump gemini adapter version'

echo "ok: $pass | falhas: $fail"
[ "$fail" -eq 0 ]
