#!/usr/bin/env bash
set -euo pipefail

# Tizen Package Script
# Packages the built Tizen app as a .wgt (Web Application archive)
#
# Usage:
#   ./scripts/package.sh                    # Creates chroma-channel.wgt
#   ./scripts/package.sh --output custom.wgt  # Custom output filename
#   ./scripts/package.sh --sign --profile MyCert  # Sign with certificate
#
# Store flow (release CI, "Package Tizen (signed)"):
#   ./scripts/package.sh --skip-build --sign --profile example-profile
# Leaves EXACTLY ONE (signed) .wgt in build/ and writes build/package-meta.json.

OUTPUT_NAME="chroma-channel.wgt"
SIGN=false
CERT_PROFILE="Sample"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WGT_DIR="${SCRIPT_DIR}/../dist"
BUILD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)/build"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUTPUT_NAME="$2"
      shift 2
      ;;
    --sign)
      SIGN=true
      shift
      ;;
    --profile)
      CERT_PROFILE="$2"
      shift 2
      ;;
    --skip-build)
      # This script packages an existing dist/ (the build is done separately in
      # CI). Accept the flag for interface parity with the webOS packager; no-op.
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--output <filename.wgt>] [--sign] [--profile <cert_name>] [--skip-build] [--help]"
      echo ""
      echo "Options:"
      echo "  --output <file>    Output filename (default: chroma-channel.wgt)"
      echo "  --sign             Sign the package with certificate"
      echo "  --profile <name>   Certificate profile name (default: Sample)"
      echo "  --skip-build       Accept for CI interface parity (dist/ is pre-built)"
      echo "  --help             Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

WGT_FILE="${BUILD_DIR}/${OUTPUT_NAME}"

# Step 1: Ensure build exists
if [[ ! -d "$WGT_DIR" ]]; then
  echo "Build directory not found. Run 'npm run build' first."
  exit 1
fi

# Step 2: Prepare dist directory with config.xml
# The .wgt format requires config.xml at the root of the archive
mkdir -p "$BUILD_DIR"
WGT_WORK="${BUILD_DIR}/wgt-work"
rm -rf "$WGT_WORK"
mkdir -p "$WGT_WORK"

# Copy all built files
cp -r "$WGT_DIR"/* "$WGT_WORK/"
# Copy config.xml from the source directory
cp "$(dirname "$0")/../config.xml" "$WGT_WORK/config.xml"

# Generate legacy assets and stage the pinned launcher icon (F1 gate)
TIZEN_SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$TIZEN_SRC_DIR/../.." && pwd)"
mkdir -p "$TIZEN_SRC_DIR/assets"
node "$REPO_ROOT/scripts/gen-icons.mjs" "$TIZEN_SRC_DIR/assets" > /dev/null
mkdir -p "$WGT_WORK/assets"
cp "$REPO_ROOT/assets/launcher/roku.png" "$WGT_WORK/assets/launcher-roku.png"

# Step 2.5: verify shared CSS is bundled in dist (E2 gate)
node "$REPO_ROOT/scripts/check-css-bundled.mjs" tizen

# Step 2.6: verify all referenced image assets exist in stage and exceed 1 KB (F1 gate)
node "$REPO_ROOT/scripts/check-package-assets.mjs" tizen "$WGT_WORK" "$TIZEN_SRC_DIR"

# Step 2.7: verify config.xml declares the store-required privileges (F2 gate)
node "$REPO_ROOT/scripts/check-manifest-completeness.mjs" tizen "$TIZEN_SRC_DIR"

# Step 2.9: pin staging mtimes so an unchanged dist re-packages to the same bytes (WEB-015)
bash "$REPO_ROOT/scripts/deterministic-stage.sh" "$WGT_WORK"

# Step 3: create the .wgt
echo "Packaging: $WGT_FILE"
cd "$WGT_WORK"

# Remove any prior build output so the release glob only sees this run's artifact
rm -f "$BUILD_DIR"/*.wgt

# The .wgt format is just a zip with config.xml at the root
zip -X -r "$WGT_FILE" . \
  -x "*.DS_Store" \
  -x "__MACOSX/*" \
  -x "*.wgt" \
  -x "*.zip" \
  -x "wgt-work/*"

echo "Created: $WGT_FILE"
echo "Size: $(du -h "$WGT_FILE" | cut -f1)"

# Step 4: Sign if requested
if [[ "$SIGN" == true ]]; then
  echo ""
  echo "Signing package..."

  # Find Tizen CLI
  TIZEN_CLI=""
  for path in "$HOME/tizen-studio/tools/ide/bin/tizen" \
              "/opt/tizen-studio/tools/ide/bin/tizen" \
              "$HOME/tizen-studio/tools/ide/bin/tizen.sh" \
              "/opt/tizen-studio/tools/ide/bin/tizen.sh"; do
    if [[ -x "$path" ]]; then
      TIZEN_CLI="$path"
      break
    fi
  done

  if [[ -z "$TIZEN_CLI" ]]; then
    echo "ERROR: Tizen CLI not found. Cannot sign package." >&2
    echo "To sign, install Tizen Studio and ensure the CLI is in PATH." >&2
    echo "Certificate profile: $CERT_PROFILE" >&2
    exit 1
  fi

  # The Tizen CLI re-signs the existing wgt in place: it reads $WGT_FILE and
  # writes the signed result under the SAME basename in the -o dir (there is NO
  # '-signed' suffix). The signed artifact therefore replaces the unsigned one,
  # leaving EXACTLY ONE .wgt in build/ (the CI's signature validator requires
  # exactly one). Fail closed if the CLI itself errors (set -e would too, but
  # this surfaces a specific message).
  if ! "$TIZEN_CLI" package -t wgt -s "$CERT_PROFILE" -- "$WGT_FILE" -o "$BUILD_DIR"; then
    echo "ERROR: Tizen CLI signing failed (profile: $CERT_PROFILE)." >&2
    echo "An unsigned wgt is not store-submittable; aborting." >&2
    exit 1
  fi
  SIGNED_FILE="$BUILD_DIR/${OUTPUT_NAME}"
  if [[ ! -f "$SIGNED_FILE" ]]; then
    echo "ERROR: Signing was requested but no signed package was produced." >&2
    echo "Expected: $SIGNED_FILE" >&2
    exit 1
  fi

  # Verify the signature is genuine (author-signature.xml + signature1.xml
  # XMLDSig structure). An unsigned or malformed package must fail the build.
  if ! node "$REPO_ROOT/scripts/validate-tizen-signature.mjs" "$SIGNED_FILE"; then
    echo "ERROR: Signed package failed signature validation. Not store-ready." >&2
    echo "  package: $SIGNED_FILE" >&2
    exit 1
  fi

  echo "Signed: $SIGNED_FILE"
  echo "Size: $(du -h "$SIGNED_FILE" | cut -f1)"
fi

# Step 4.5: record package metadata (packager truth) for CI/store tooling.
# Mirrors the webOS package-meta.json contract (WEB-011 chain). A tizen-cli
# signed wgt carries author-signature.xml + signature1.xml and is store-ready;
# the plain unsigned zip is diagnostic-only and NOT store-submittable.
PACKAGER="zip"
FINAL_FILE="$WGT_FILE"
if [[ "$SIGN" == true ]]; then
  PACKAGER="tizen-cli"
  FINAL_FILE="$SIGNED_FILE"
fi
META_FILE="$BUILD_DIR/package-meta.json"
node -e '
  const fs = require("node:fs");
  const pathMod = require("node:path");
  const [xmlPath, packager, file, out] = process.argv.slice(1);
  const xml = fs.readFileSync(xmlPath, "utf8");
  const appId = (xml.match(/<tizen:application[^>]*id="([^"]+)"/) || [])[1]
    || (xml.match(/<widget[^>]*id="([^"]+)"/) || [])[1]
    || "unknown";
  const version = (xml.match(/<widget[^>]*version="([^"]+)"/) || [])[1] || "0.0.0";
  const meta = { platform: "tizen", appId, version, file, packager, storeReady: packager === "tizen-cli" };
  fs.mkdirSync(pathMod.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(meta, null, 2) + "\n");
  console.log("[package-meta] " + out + " packager=" + meta.packager + " storeReady=" + meta.storeReady);
' "$TIZEN_SRC_DIR/config.xml" "$PACKAGER" "$FINAL_FILE" "$META_FILE"
if [[ "$SIGN" != true ]]; then
  echo "NOTE: store submission to Samsung Seller Office requires a tizen-cli-signed wgt (author-signature.xml + signature1.xml)."
fi

# Success path only (set -e above): drop the intermediate staging directory so
# build/ contains nothing but the final .wgt and package-meta.json. The staging
# tree lives outside the archive and has no post-package consumer.
rm -rf "$WGT_WORK"

echo ""
echo "=== Package complete ==="
echo "File: $FINAL_FILE"
if [[ "$SIGN" == true ]]; then
  echo "Signing: SIGNED ($SIGNED_FILE) — signature validated"
else
  echo "Signing: UNSIGNED (local dev; use --sign for a store-submittable package)"
fi
echo ""
echo "To install on a Samsung TV:"
echo "  1. Enable Developer Mode on the TV (Apps -> 12345 -> Developer Mode: ON)"
echo "  2. Note the TV's IP address (Settings -> Network -> Network Status)"
echo "  3. Run: tizen install -n $(basename "$FINAL_FILE") -s <TV_IP>:26101 -- $(dirname "$FINAL_FILE")"
echo ""
echo "Or use the deploy script:"
echo "  ./scripts/deploy.sh --tv-ip <TV_IP>"
