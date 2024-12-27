#!/usr/bin/env bash
set -eou pipefail

if command -v git > /dev/null; then
  git -C "$(dirname "$0")" config core.hooksPath hooks
fi

deno install --allow-scripts

deno run \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --allow-run \
  --allow-import \
  --allow-sys \
  --check \
  "$(dirname "$0")/main.ts" \
  "$@"
