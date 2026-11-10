# Local package reproducibility

Run `npm run build`, `npm run package:local`, then `npm run repro` on Linux
with Node 24, Bash, zip/unzip, GNU tar and ar. No credentials or vendor SDKs
are needed for this diagnostic path. CI runs the complete unit/contract suite
and this packaging gate. It does not sign, deploy, publish or certify store apps.

The gate packages each platform twice into distinct temporary paths, compares
entry names and payload hashes, and restores any pre-existing artifact. Tizen
and Vizio unsigned archive bytes must also match. `SOURCE_DATE_EPOCH` controls
staging timestamps; permission bits are normalized before archiving.

The webOS fallback is a diagnostic tar, not an installable store IPK. With the
official vendor packager, container timestamps and `control/control`
`Installed-Size` can vary; payload bytes still must match. Tizen signature files
`author-signature.xml` and `signature1.xml` are accepted extras only when comparing
a locally signed artifact with an unsigned rebuild. Re-sign comparisons require
explicit `--tizen-flags` and a profile in the developer's SDK, never hosted CI.

`assets/generated/splash.png` is a pinned input because `deflateSync` bytes can
differ across Node/zlib versions even for identical pixels. Launcher PNGs and the
splash are generated solely by `scripts/gen-icons.mjs`, not customer artwork.
Their geometry and pixel content are tested against that source. The legacy
`roku` filenames remain metadata compatibility names, not Roku branding.
After changing the splash generator design, run `npm run icons:pin` to update
the pinned input together with the source change and its pixel tests.

Checksums identify diagnostic artifacts, not proof of vendor acceptance. No
hardware playback, remote navigation or vendor-store certification is implied.
