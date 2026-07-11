#!/usr/bin/env bash
# Instala git-hooks versionados do my-harness-config no repositorio atual.
# Uso:
#   ./scripts/install-git-hooks.sh
#   ./scripts/install-git-hooks.sh /caminho/para/outro/repo
#   ./scripts/install-git-hooks.sh --project-copy   # tambem copia para .githooks/ no projeto
set -euo pipefail

CONFIG_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_SRC="$CONFIG_ROOT/git-hooks"
PROJECT_COPY=false

if [[ "${1:-}" == "--project-copy" ]]; then
  PROJECT_COPY=true
  shift
fi

TARGET_REPO="${1:-$(git -C "${PWD}" rev-parse --show-toplevel 2>/dev/null || true)}"
if [[ -z "$TARGET_REPO" || ! -d "$TARGET_REPO/.git" ]]; then
  echo "ERRO: informe um repositorio git ou rode dentro de um clone." >&2
  exit 1
fi

HOOKS_DST="$TARGET_REPO/.git/hooks"
for hook in commit-msg prepare-commit-msg forbidden-patterns.sh; do
  if [[ ! -f "$HOOKS_SRC/$hook" ]]; then
    echo "ERRO: hook ausente: $HOOKS_SRC/$hook" >&2
    exit 1
  fi
  install -m 755 "$HOOKS_SRC/$hook" "$HOOKS_DST/$hook" 2>/dev/null || {
    cp "$HOOKS_SRC/$hook" "$HOOKS_DST/$hook"
    chmod 755 "$HOOKS_DST/$hook"
  }
  echo "ok $hook -> $HOOKS_DST/$hook"
done

if $PROJECT_COPY; then
  PROJECT_HOOKS="$TARGET_REPO/.githooks"
  mkdir -p "$PROJECT_HOOKS"
  for hook in commit-msg prepare-commit-msg forbidden-patterns.sh; do
    cp "$HOOKS_SRC/$hook" "$PROJECT_HOOKS/$hook"
    chmod 755 "$PROJECT_HOOKS/$hook"
  done
  echo "ok copiado para $PROJECT_HOOKS/"
fi

echo "Hooks instalados em $TARGET_REPO"
