#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIZEN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$TIZEN_DIR/../.." && pwd)"
TV_IP=""
ARTIFACT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tv-ip|--artifact)
      [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || { echo "Missing value for $1" >&2; exit 1; }
      if [[ "$1" == --tv-ip ]]; then TV_IP="$2"; else ARTIFACT="$2"; fi
      shift 2 ;;
    --help|-h)
      echo "Usage: $0 --tv-ip <IP> [--artifact <signed.wgt>]"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
[[ "$TV_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "--tv-ip requires an IPv4 address" >&2; exit 1; }
SERIAL="$TV_IP:26101"
TIZEN_CLI="$(command -v tizen || true)"
SDB_CLI="$(command -v sdb || true)"
for sdk in "$HOME/tizen-studio" /opt/tizen-studio; do
  if [[ -z "$TIZEN_CLI" && -x "$sdk/tools/ide/bin/tizen" ]]; then TIZEN_CLI="$sdk/tools/ide/bin/tizen"; fi
  if [[ -z "$SDB_CLI" && -x "$sdk/tools/sdb" ]]; then SDB_CLI="$sdk/tools/sdb"; fi
done
[[ -n "$TIZEN_CLI" && -n "$SDB_CLI" ]] || { echo "Native Tizen Studio tizen and sdb required" >&2; exit 1; }
if [[ -z "$ARTIFACT" ]]; then
  [[ -n "${TIZEN_CERT_PROFILE:-}" ]] || { echo "TIZEN_CERT_PROFILE required for an explicit signing profile" >&2; exit 1; }
  (cd "$TIZEN_DIR" && npm run build)
  bash "$SCRIPT_DIR/package.sh" --skip-build --sign --profile "$TIZEN_CERT_PROFILE" --output signed.wgt
  ARTIFACT="$TIZEN_DIR/build/signed.wgt"
fi
[[ -f "$ARTIFACT" && "$ARTIFACT" == *.wgt ]] || { echo "Existing signed WGT required" >&2; exit 1; }
ARTIFACT="$(cd "$(dirname "$ARTIFACT")" && pwd)/$(basename "$ARTIFACT")"
[[ "$(basename "$ARTIFACT")" != *[[:space:]]* ]] || { echo "WGT basename must be space-free" >&2; exit 1; }
node "$REPO_ROOT/scripts/validate-tizen-signature.mjs" "$ARTIFACT"
"$SDB_CLI" connect "$SERIAL"
INSTALL_OUTPUT="$("$TIZEN_CLI" install -n "$(basename "$ARTIFACT")" -s "$SERIAL" -- "$(dirname "$ARTIFACT")" 2>&1)" || { printf '%s\n' "$INSTALL_OUTPUT" >&2; exit 1; }
printf '%s\n' "$INSTALL_OUTPUT"
grep -Eiq 'install completed' <<< "$INSTALL_OUTPUT" || { echo "No install-completed proof" >&2; exit 1; }
APP_ID="$(sed -n 's/.*<tizen:application id="\([^"]*\)".*/\1/p' "$TIZEN_DIR/config.xml")"
[[ "$APP_ID" =~ ^[A-Za-z0-9.]+$ ]] || { echo "Invalid application ID in config.xml" >&2; exit 1; }
LAUNCH_OUTPUT="$("$TIZEN_CLI" run -p "$APP_ID" -s "$SERIAL" 2>&1)" || { printf '%s\n' "$LAUNCH_OUTPUT" >&2; exit 1; }
printf '%s\n' "$LAUNCH_OUTPUT"
grep -Eiq 'successfully launched pid[[:space:]:=]+[1-9][0-9]*([^0-9]|$)' <<< "$LAUNCH_OUTPUT" || { echo "No launch PID proof" >&2; exit 1; }
echo "Installed and launched $ARTIFACT on $SERIAL"
