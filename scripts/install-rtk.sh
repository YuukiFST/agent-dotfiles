#!/usr/bin/env bash
# Install the rtk release pinned in rtk-pin.txt into ~/.local/bin, refusing an archive whose
# SHA256 differs from the pin. Shared by setup-claude.sh, setup-pi.sh, setup-opencode.sh and
# update-claude.sh; re-running it reinstalls the same pinned build.
set -euo pipefail

pin="$(dirname "$0")/rtk-pin.txt"
tag="$(awk '$1 == "tag" { print $2 }' "$pin")"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) target=x86_64-unknown-linux-musl ;;
  Linux-aarch64 | Linux-arm64) target=aarch64-unknown-linux-musl ;;
  Darwin-x86_64) target=x86_64-apple-darwin ;;
  Darwin-arm64) target=aarch64-apple-darwin ;;
  *)
    echo "install-rtk: rtk-pin.txt pins no build for $(uname -s)-$(uname -m); add its line from the release's checksums.txt." >&2
    exit 1
    ;;
esac
asset="rtk-$target.tar.gz"
expected="$(awk -v asset="$asset" '$2 == asset { print $1 }' "$pin")"
if [ -z "$expected" ]; then
  echo "install-rtk: rtk-pin.txt has no SHA256 for $asset; copy its line from the $tag checksums.txt." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "https://github.com/rtk-ai/rtk/releases/download/$tag/$asset" -o "$tmp/$asset"
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | awk '{ print $1 }')"
else
  actual="$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')"
fi
if [ "$actual" != "$expected" ]; then
  echo "install-rtk: SHA256 of $asset ($tag) is $actual, rtk-pin.txt expects $expected; nothing was installed." >&2
  echo "Compare both with the release page before changing rtk-pin.txt." >&2
  exit 1
fi

# Extract only the rtk entry, so a crafted archive cannot write outside $tmp.
tar -xzf "$tmp/$asset" -C "$tmp" rtk
bin="$HOME/.local/bin"
mkdir -p "$bin"
cp "$tmp/rtk" "$bin/rtk"
chmod +x "$bin/rtk"
"$bin/rtk" --version
