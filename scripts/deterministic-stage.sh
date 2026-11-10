#!/usr/bin/env bash
# Normalise a staging tree before it is archived: one mode rule for every entry, and every mtime
# pinned to one fixed instant. Both are needed; the header used to promise only the second.
#
# Why this exists: zip and tar derive their container metadata from file mtimes, so
# packaging an UNCHANGED dist twice produced different bytes. Measured on 2026-10-27,
# on the same host and the same dist, two runs of each packager hashed differently:
# webOS .ipk dfa1c19b vs 5b3daa8b, Vizio .zip 44efa70c vs 974a6b5e, Tizen .wgt
# 658ee281 vs 17c7890d. A release whose bytes move on their own cannot be audited or
# re-derived, so the stage tree - a disposable copy, never the working tree - is pinned.
#
# 315532800 is 1980-01-01T00:00:00Z, the earliest instant a ZIP local header can store,
# so no entry is clamped forward and the pinned tree is identical on every host. Set
# SOURCE_DATE_EPOCH to override (rebuild-from-source tooling convention).
set -euo pipefail

STAGE="${1:?staging directory required}"
EPOCH="${SOURCE_DATE_EPOCH:-315532800}"

[[ -d "$STAGE" ]] || { echo "ERROR: no staging tree at $STAGE" >&2; exit 1; }

# Modes first, then times. `zip -X` keeps the permission bits in each entry's external
# attributes and tar/gzip carry them too, so a stage tree copied under one umask publishes
# different bytes from the same content copied under another. Measured on 2026-10-27 at one
# commit with one toolchain, packaging the Vizio stage:
#   umask 077 -> fab486930a678cb7... (every stage file 0600)
#   umask 022 -> 0cd2ccf4dd57bf2a... (0600 and 0644 mixed)
#   umask 0002 (this host) -> 99646ee2508b2a73... (0664)
# Three hashes for identical content. One rule removes the dependency, keeping the only piece of
# intent a mode carries in a staged web app: the executable bit. Nothing staged today uses it,
# which is why the rule preserves it rather than flattening everything to 0644.
find "$STAGE" -type d -exec chmod 0755 {} +
find "$STAGE" -type f -perm -u+x -exec chmod 0755 {} +
find "$STAGE" -type f ! -perm -u+x -exec chmod 0644 {} +

find "$STAGE" -exec touch -h -d "@$EPOCH" {} +
