#!/usr/bin/env bash
set -euo pipefail

# webOS Packaging Script
# Produces a real, installable .ipk channel package from the production build.
#
# The .ipk format is a tar archive containing APPINFO at the root of the
# package (plus the app assets). This mirrors what the official
# ares-package tool does: we use ares-package when available and fall back
# to an equivalent tar-based packager otherwise, so the pipeline works in
# CI without the proprietary LG SDK.
#
# Usage:
#   ./scripts/package.sh                 # build + package
#   ./scripts/package.sh --skip-build    # package an existing dist/
#
# Output:
#   build/chroma-channel-<version>.ipk

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEBOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEBOS_DIR/../.." && pwd)"
BUILD_DIR="$WEBOS_DIR/build"
DIST_DIR="$WEBOS_DIR/dist"
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--skip-build] [--help]"
      exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Read the channel version from appinfo.json (single source of truth)
APP_ID=$(node -e "console.log(require('$WEBOS_DIR/appinfo.json').id)")
APP_VERSION=$(node -e "console.log(require('$WEBOS_DIR/appinfo.json').version)")
echo "=== Packaging ${APP_ID} v${APP_VERSION} ==="

# Step 1: production build
# The build must be unconditional unless --skip-build was passed explicitly.
# It used to run only when dist/index.html was missing, so any existing dist/
# made the default invocation package stale bytes silently: a commit could land
# and `package.sh` still shipped the previous build (the packaged payload then
# disagrees with HEAD, which is what the version string exposed).
if [[ "$SKIP_BUILD" == true ]]; then
  echo "Skipping build (--skip-build): packaging dist/ exactly as it stands."
  if [[ ! -f "$DIST_DIR/index.html" ]]; then
    echo "ERROR: --skip-build given but no dist/ found. Run without --skip-build." >&2
    exit 1
  fi
else
  (cd "$WEBOS_DIR" && npm run build)
fi

# Step 2: stage the channel payload
STAGE_DIR="$BUILD_DIR/stage"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
cp -r "$DIST_DIR/." "$STAGE_DIR/"
# Keep both forms: the official CLI requires appinfo.json, while the diagnostic
# archive and existing package checks also consume APPINFO.
cp "$WEBOS_DIR/appinfo.json" "$STAGE_DIR/appinfo.json"
cp "$WEBOS_DIR/appinfo.json" "$STAGE_DIR/APPINFO"
# Generate the legacy assets; stage the pinned launcher artwork and splash.
mkdir -p "$WEBOS_DIR/assets"
node "$REPO_ROOT/scripts/gen-icons.mjs" "$WEBOS_DIR/assets" > /dev/null
mkdir -p "$STAGE_DIR/assets"
cp "$REPO_ROOT/assets/launcher/roku-80.png" "$STAGE_DIR/assets/launcher-roku-80.png"
cp "$REPO_ROOT/assets/launcher/roku-130.png" "$STAGE_DIR/assets/launcher-roku-130.png"
# assets/splash.png is staged from the PINNED input, never from this run's gen-icons
# output. `deflateSync(level 9)` output moves with the Node build - published v0.1.0 ships
# a 4198 B splash where a rebuild here produced 4188 B for pixel-identical art - so
# packaging the freshly deflated file made published bytes depend on the toolchain that
# built them (WEB-015a). The stored (level 0) icons above were proven byte-identical across
# toolchains and stay generated.
if [ ! -f "$REPO_ROOT/assets/generated/splash.png" ]; then
  echo "ERROR: missing pinned splash asset: $REPO_ROOT/assets/generated/splash.png" >&2
  echo "       Run 'npm run icons:pin' to re-render it from scripts/gen-icons.mjs, then commit it." >&2
  exit 1
fi
cp "$REPO_ROOT/assets/generated/splash.png" "$STAGE_DIR/assets/splash.png"
echo "Staged payload in $STAGE_DIR ($(du -sh "$STAGE_DIR" | cut -f1))"

# Step 2.5: verify shared CSS is bundled in dist (E2 gate)
node "$WEBOS_DIR/../../scripts/check-css-bundled.mjs" webos

# Step 2.6: verify all referenced image assets exist in stage and exceed 1 KB (F1 gate)
node "$WEBOS_DIR/../../scripts/check-package-assets.mjs" webos "$STAGE_DIR" "$WEBOS_DIR"

# Step 2.7: verify appinfo.json is valid (F2 gate)
node "$WEBOS_DIR/../../scripts/check-manifest-completeness.mjs" webos "$WEBOS_DIR"

# Step 2.9: pin staging mtimes so an unchanged dist re-packages to the same bytes (WEB-015)
bash "$REPO_ROOT/scripts/deterministic-stage.sh" "$STAGE_DIR"

# Step 3: create the .ipk
# Remove any prior build output so the release glob only sees this run's artifact
rm -f "$BUILD_DIR"/*.ipk
IPK_FILE="$BUILD_DIR/${APP_ID}-${APP_VERSION}.ipk"
rm -f "$IPK_FILE"

if command -v ares-package >/dev/null 2>&1; then
  echo "Using official ares-package (webOS TV SDK)."
  PACKAGER=ares
  # Vite already minified the browser-tested runtime; preserve those bytes.
  ares-package --no-minify "$STAGE_DIR" -o "$BUILD_DIR" > /dev/null
  # The official CLI uses <id>_<version>_all.ipk. Normalize it so downstream
  # checksum, artifact, and release paths remain stable.
  FOUND=$(find "$BUILD_DIR" -maxdepth 1 -type f -name "*.ipk" ! -path "$IPK_FILE" -print -quit)
  if [[ -n "$FOUND" && -f "$FOUND" ]]; then
    mv -f "$FOUND" "$IPK_FILE"
  else
    echo "ERROR: ares-package did not produce an .ipk"
    exit 1
  fi
else
  echo "ares-package not found - using tar-based packager (CI/diagnostic only, NOT store-submittable)."
  PACKAGER=tar
  REPRO_EPOCH="${SOURCE_DATE_EPOCH:-315532800}"
  (cd "$STAGE_DIR" && tar --sort=name --mtime="@$REPRO_EPOCH" --owner=0 --group=0 --numeric-owner -cf - .) | gzip -n -c > "$IPK_FILE"
fi

if [[ ! -f "$IPK_FILE" ]]; then
  echo "ERROR: package creation failed."
  exit 1
fi

# Step 3.5: record which packager produced the .ipk (F3)
# build/package-meta.json lets CI/store tooling tell a tar-based CI artifact
# apart from a store-submittable ares-package build.
META_FILE="$BUILD_DIR/package-meta.json"
node "$WEBOS_DIR/../../scripts/package-meta.mjs" \
  --packager "$PACKAGER" \
  --app-id "$APP_ID" \
  --version "$APP_VERSION" \
  --file "$IPK_FILE" \
  --out "$META_FILE"
if [[ "$PACKAGER" != "ares" ]]; then
  echo "NOTE: store submission to LG Seller Lounge requires an ares-package build (webOS TV SDK)."
fi

# Step 4: self-verify the artifact (this is what CI asserts)
echo "=== Verifying package ==="
TMP_UNPACK="$(mktemp -d)"
if [[ "$PACKAGER" == "ares" ]]; then
  ares-package --info-detail "$IPK_FILE" > /dev/null
  ar p "$IPK_FILE" data.tar.gz | tar -xzf - -C "$TMP_UNPACK"
  APP_ROOT="$TMP_UNPACK/usr/palm/applications/$APP_ID"
  APPINFO_FILE="$APP_ROOT/appinfo.json"
else
  tar -xzf "$IPK_FILE" -C "$TMP_UNPACK"
  APP_ROOT="$TMP_UNPACK"
  APPINFO_FILE="$APP_ROOT/APPINFO"
fi
for req in "$APPINFO_FILE" "$APP_ROOT/index.html"; do
  if [[ ! -f "$req" ]]; then
    echo "ERROR: ${req#"$TMP_UNPACK/"} missing from .ipk — invalid package."
    rm -rf "$TMP_UNPACK"
    exit 1
  fi
done
node -e "const a=JSON.parse(require('fs').readFileSync('$APPINFO_FILE','utf8')); if(!a.id || !a.version || a.type!=='web') throw new Error('bad appinfo: ' + JSON.stringify({id:a.id,version:a.version,type:a.type})); console.log('appinfo valid:', a.id, 'v' + a.version);"
rm -rf "$TMP_UNPACK"

echo "Package OK: $IPK_FILE ($(du -h "$IPK_FILE" | cut -f1))"
echo "Install on device: ares-install -o <tv_ip> $IPK_FILE"
