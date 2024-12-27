#!/usr/bin/env bash
set -eou pipefail

name="mediawiki-rc-mastodon-bot"
declare -A targets=(
  [x86_64-unknown-linux-gnu]=".tar.gz "
  [x86_64-pc-windows-msvc]=".zip .exe"
  [x86_64-apple-darwin]=".tar.gz "
  [aarch64-apple-darwin]=".tar.gz "
)

root_dir="$(dirname "$0")"
dist_dir=dist

version="$(deno eval 'import m from "./deno.json" with { type: "json" }; console.log(m.version)')"
mkdir -p "$dist_dir"
for target in "${!targets[@]}"; do
  echo "Building for $target..." >&2
  tmpdir="$(mktemp -d)"
  dist_suffix="${targets[$target]/ *}"
  bin_suffix="${targets[$target]/* }"
  bin_name="$name$bin_suffix"
  deno compile \
    --allow-net \
    --allow-read \
    --allow-write \
    --allow-env \
    --allow-run \
    --allow-import \
    --allow-sys \
    --check \
    --target="$target" \
    --output="$tmpdir/$bin_name" \
    "$root_dir/main.ts"
  dist_name="$name-$version.$target$dist_suffix"
  cp ./*.md "$tmpdir"
  cp LICENSE "$tmpdir"
  pushd "$tmpdir"
  case "$dist_suffix" in
    .tar.gz)
      tar -czf "$dist_name" "$bin_name" ./*.md LICENSE
      ;;
    .zip)
      if command -v 7z > /dev/null; then
        7z a "$dist_name" "$bin_name" ./*.md LICENSE
      else
        zip -r "$dist_name" "$bin_name" ./*.md LICENSE
      fi
      ;;
    *)
      echo "Unknown suffix: $dist_suffix" >&2
      exit 1
  esac
  popd
  mv "$tmpdir/$dist_name" "$dist_dir/"
done
