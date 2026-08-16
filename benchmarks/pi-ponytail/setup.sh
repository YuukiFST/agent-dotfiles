#!/usr/bin/env bash
# One-time vendor fetch for ponytail instruction builder (no pi install required).
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
vendor="$dir/.vendor/ponytail"
if [ -f "$vendor/hooks/ponytail-instructions.js" ]; then
  echo "ponytail vendor OK: $vendor"
  exit 0
fi
mkdir -p "$dir/.vendor"
git clone --depth 1 https://github.com/DietrichGebert/ponytail.git "$vendor"
echo "ponytail vendor ready: $vendor"
