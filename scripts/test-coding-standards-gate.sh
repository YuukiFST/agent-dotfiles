#!/usr/bin/env bash
# End-to-end test for hooks/coding-standards-gate.js, fed the JSON Claude Code sends on stdin.
# Run: bash scripts/test-coding-standards-gate.sh
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
GATE="$REPO/hooks/coding-standards-gate.js"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# os.homedir() reads HOME on Linux and USERPROFILE on Windows; os.tmpdir() reads TMPDIR/TEMP.
export HOME="$WORK/home" USERPROFILE="$WORK/home" TMPDIR="$WORK/tmp" TEMP="$WORK/tmp" TMP="$WORK/tmp"
mkdir -p "$HOME/.claude" "$TMPDIR"
cp "$REPO/CODING_STANDARDS.md" "$HOME/.claude/CODING_STANDARDS.md"
cp "$REPO/PROMPT_ENGINEERING.md" "$HOME/.claude/PROMPT_ENGINEERING.md"

pass=0
fail=0
check() { # $1 = case name, $2 = condition result (0 = ok)
  if [ "$2" -eq 0 ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FALHOU: $1" >&2; fi
}

gate() { # $1 = stdin JSON, rest = extra args
  local input="$1"
  shift
  printf '%s' "$input" | node "$GATE" "$@"
}

# Claude Code moves an additionalContext over 10,000 characters to a file and passes only a
# preview, so the injection must stay under it.
out="$(gate '{"session_id":"s1"}')"
printf '%s' "$out" | node -e '
  const o = JSON.parse(require("fs").readFileSync(0, "utf8")).hookSpecificOutput;
  if (o.hookEventName !== "PreToolUse") process.exit(1);
  if (!o.additionalContext.includes("## Leave no trace")) process.exit(2);
  if (o.additionalContext.length >= 10000) { console.error("additionalContext: " + o.additionalContext.length + " chars"); process.exit(3); }
'
check "primeira edicao injeta o arquivo inteiro, abaixo de 10.000 caracteres" $?

[ -z "$(gate '{"session_id":"s1"}')" ]
check "segunda edicao da sessao nao injeta de novo" $?

[ -n "$(gate '{"session_id":"s1","agent_id":"sub-1"}')" ]
check "subagente da mesma sessao recebe a propria injecao" $?

gate '{"session_id":"s1"}' --reset
[ -n "$(gate '{"session_id":"s1"}')" ]
check "depois de --reset (compaction) injeta de novo" $?

[ -z "$(gate 'not json')" ]
check "stdin invalido nao imprime nada" $?

edit() { # $1 = session id, $2 = file_path as a JSON string body
  gate "$(printf '{"session_id":"%s","tool_input":{"file_path":"%s"}}' "$1" "$2")"
}
injects() { # $1 = hook output, $2 = text the injected file must contain
  printf '%s' "$1" | node -e '
    const c = JSON.parse(require("fs").readFileSync(0, "utf8")).hookSpecificOutput.additionalContext;
    process.exit(c.includes(process.argv[1]) && c.length < 10000 ? 0 : 1);
  ' "$2"
}

injects "$(edit p1 /repo/skills/x/SKILL.md)" "## Evaluations"
check "primeira edicao de arquivo de prompt injeta PROMPT_ENGINEERING.md, abaixo de 10.000" $?

injects "$(edit p1 /repo/src/app.ts)" "## Leave no trace"
check "padroes de codigo chegam na edicao seguinte" $?

[ -z "$(edit p1 /repo/CLAUDE.md)" ]
check "com os dois injetados, nada mais e injetado" $?

injects "$(edit p2 /repo/src/app.ts)" "## Leave no trace" && injects "$(edit p2 /repo/rules/git.md)" "## Evaluations"
check "sessao que comeca em codigo recebe PROMPT_ENGINEERING.md na primeira edicao de prompt" $?

injects "$(edit p3 'C:\\repo\\AGENTS.md')" "## Evaluations"
check "caminho Windows de AGENTS.md conta como arquivo de prompt" $?

rm "$HOME/.claude/CODING_STANDARDS.md"
[ -z "$(gate '{"session_id":"s2"}')" ] && [ ! -e "$TMPDIR/claude-coding-standards/s2/main--standards" ]
check "arquivo ausente nao injeta nem grava marcador" $?

echo "ok: $pass | falhas: $fail"
[ "$fail" -eq 0 ]
