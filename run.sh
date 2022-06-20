#!/usr/bin/env bash
set -eou pipefail

if command -v git > /dev/null; then
  git config core.hooksPath hooks
fi

deno run \
  --allow-net \
  --allow-read \
  --allow-write \
  --allow-env \
  --allow-run \
  --unstable \
  --config="$(dirname "$0")/deno.jsonc" \
  --check \
  --lock="$(dirname "$0")/lock.json" \
  main.ts \
  "$@"
