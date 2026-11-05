#!/usr/bin/env bash
# Quahog game — gate runner (human or CI).
# Runs the quality gates in order and FAILS FAST on the first failure.
# Gate order (do not reorder): tsc -> vitest -> blizzard -> vite build.
# This script builds ONLY. It never deploys. Deploy = SETUP.md procedure.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "== Quahog gate run: $ROOT =="

# Dependencies: install only if missing (CI runners always start clean
# and run `npm ci` themselves before this script).
if [ ! -d node_modules ]; then
  echo "--- gate 0: npm ci ---"
  npm ci
else
  echo "--- gate 0: node_modules present, skipping install ---"
fi

echo "--- gate 1: tsc --noEmit ---"
npx tsc --noEmit

echo "--- gate 2: vitest (npm run test) ---"
npm run test

echo "--- gate 3: blizzard (npm run test:blizzard) ---"
npm run test:blizzard

echo "--- gate 4: vite build (npm run build) ---"
npm run build

echo "--- gate 5: music guard ---"
bash scripts/check-no-music.sh

BUNDLE="$(ls dist/assets/main-*.js 2>/dev/null | head -1 || true)"
echo "== ALL GATES PASSED =="
echo "bundle: ${BUNDLE:-<none found in dist/assets/>}"
echo "Next: deploy manually per SETUP.md (backup -> rsync --exclude music -> verify)."
