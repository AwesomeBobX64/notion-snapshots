#!/bin/sh
set -eu

target="${1:-}"
outfile="${2:-}"
bun_bin="${BUN_BIN:-bun}"

if [ -z "$target" ] || [ -z "$outfile" ]; then
  echo "Usage: sh ./scripts/build-release-target.sh <bun-target> <outfile>" >&2
  exit 1
fi

mkdir -p "$(dirname "$outfile")"

if ! "$bun_bin" build --compile --target="$target" ./src/cli/index.ts --outfile "$outfile"; then
  bun_version="$("$bun_bin" --version 2>/dev/null || echo unknown)"
  echo "Release target build failed for $target. If Bun reported InvalidTarget, upgrade to a Bun release that supports cross-target standalone builds. Current Bun: $bun_version" >&2
  exit 1
fi
