#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for bin in .tools/bin/kitex .tools/bin/hz node_modules/.bin/prettier; do
  if [ ! -x "$bin" ]; then
    echo "missing $bin; install the versions from deploy/toolchain.lock.json and run pnpm install --frozen-lockfile" >&2
    exit 1
  fi
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

list() {
  {
    printf '%s\n' \
      packages/api-client/src/generated.ts \
      idl/http-routes.generated.json \
      server/internal/transport/routes.gen.go
    find server/gen/hertz server/gen/kitex -type f -print
  } | sort
}

snapshot() {
  while IFS= read -r file; do
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$file"
    else
      shasum -a 256 "$file"
    fi
  done
}

list > "$tmp/files.before"
snapshot < "$tmp/files.before" > "$tmp/hashes.before"

go run ./tools/contractgen

list > "$tmp/files.after"
snapshot < "$tmp/files.after" > "$tmp/hashes.after"

if ! diff -q "$tmp/files.before" "$tmp/files.after" >/dev/null; then
  echo "generated file set changed after regeneration; commit the generated outputs" >&2
  diff -u "$tmp/files.before" "$tmp/files.after" || true
  exit 1
fi
if ! diff -q "$tmp/hashes.before" "$tmp/hashes.after" >/dev/null; then
  echo "generated files were stale; regeneration changed their contents" >&2
  diff -u "$tmp/hashes.before" "$tmp/hashes.after" || true
  echo "keep the regenerated outputs and rerun the check" >&2
  exit 1
fi
echo "generated contracts match the Thrift IDL"
