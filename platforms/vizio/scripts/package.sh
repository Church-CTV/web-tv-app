#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VIZIO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$VIZIO_DIR/../.." && pwd)"
BUILD_DIR="$VIZIO_DIR/build"
STAGE_DIR="$BUILD_DIR/stage"
SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --help|-h) echo "Usage: $0 [--skip-build]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
if [[ "$SKIP_BUILD" == false ]]; then
  (cd "$VIZIO_DIR" && npm run build)
fi
[[ -f "$VIZIO_DIR/dist/index.html" ]] || { echo "Build output missing" >&2; exit 1; }
APP_VERSION="$(node -p "require('$VIZIO_DIR/manifest.json').version")"
[[ "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid version" >&2; exit 1; }
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/assets"
cp -r "$VIZIO_DIR/dist/." "$STAGE_DIR/"
cp "$VIZIO_DIR/manifest.json" "$STAGE_DIR/manifest.json"
cp "$REPO_ROOT/assets/launcher/roku-120.png" "$STAGE_DIR/assets/launcher-roku-120.png"
node "$REPO_ROOT/scripts/check-css-bundled.mjs" vizio
node "$REPO_ROOT/scripts/check-package-assets.mjs" vizio "$STAGE_DIR" "$VIZIO_DIR"
node "$REPO_ROOT/scripts/check-manifest-completeness.mjs" vizio "$VIZIO_DIR"
node "$REPO_ROOT/scripts/validate-vizio-package.mjs" "$STAGE_DIR"
bash "$REPO_ROOT/scripts/deterministic-stage.sh" "$STAGE_DIR"
rm -f "$BUILD_DIR"/*.zip
ZIP_FILE="$BUILD_DIR/church-ctv-$APP_VERSION.zip"
(cd "$STAGE_DIR" && LC_ALL=C find . -type f -print | LC_ALL=C sort | zip -X -rq "$ZIP_FILE" -@)
unzip -tq "$ZIP_FILE"
echo "Local package: $ZIP_FILE (not store certified)"
