# Shared commit-message validation for commit-msg and pre-push hooks.
FORBIDDEN_TRAILER='(Co-authored-by:|Co-Authored-By:|Made-with:|Made with |Generated with |cursoragent@cursor\.com)'
# Blocks tool/AI authorship attribution in subject. Tool as object is OK — see rules/git.md §4.2.
# A named tool after an authorship preposition is always attribution.
FORBIDDEN_TOOL='\b(by|with|via|por|com|pelo|pela)[[:space:]]+(cursor|claude|copilot|codex|gemini|chatgpt|openai)\b'
# Generic terms (ia/ai/agente) are legitimate commit *subjects* — a repo about agents talks about
# agents. They only mean attribution when an authorship verb precedes them: "dashboard feito com IA"
# is blocked, "suporte a agentes de IA" is not. Matching the bare word blocked honest subjects.
FORBIDDEN_GENERIC='\b(feit[oa]|gerad[oa]|criad[oa]|escrit[oa]|produzid[oa]|desenvolvid[oa]|made|generated|created|written|authored|built)[[:space:]]+(com|por|pelo|pela|with|by|via|usando|using)[[:space:]]+(([oa]|um|uma|an?|the)[[:space:]]+)?(ia|ai|agente|agentes|intelig[eê]ncia[[:space:]]+artificial|llm)\b'
FORBIDDEN_MSG="(co-authored|co_authored|cursoragent|made.with|generated.(with|by)|${FORBIDDEN_TOOL}|${FORBIDDEN_GENERIC})"

validate_commit_message_file() {
  local msg_file="$1"
  local label="${2:-commit}"

  if grep -qiE "$FORBIDDEN_TRAILER" "$msg_file"; then
    echo "ERRO: trailer proibido em $label." >&2
    echo "Cursor injeta Co-authored-by apos git commit; use scripts/git-safe-commit.sh." >&2
    echo "Ver rules/git.md em my-harness-config." >&2
    return 1
  fi

  local subject
  subject="$(head -n 1 "$msg_file")"
  if echo "$subject" | grep -qiE "$FORBIDDEN_MSG"; then
    echo "ERRO: assunto proibido em $label." >&2
    echo "Commits descrevem apenas o codigo; sem referencias a ferramentas ou autoria extra." >&2
    echo "Ver rules/git.md em my-harness-config." >&2
    return 1
  fi

  return 0
}

validate_commit_object() {
  local commit="$1"
  local msg_file
  msg_file="$(mktemp)"
  git log -1 --format=%B "$commit" > "$msg_file"
  validate_commit_message_file "$msg_file" "commit $commit"
  local status=$?
  rm -f "$msg_file"
  return "$status"
}
