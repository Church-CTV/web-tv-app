# Release status

**PUBLIC SOURCE — first public revision 2026-11-12.** The Church CTV Community
Source License version 1.0 in `LICENSE` is operative from this revision; see
`LICENSING-STATUS.md` for what it grants and what it does not claim.

Public source is not a supported release. It is not a device certification, a
store approval, a signing identity, a hosted service or a production migration.
Unrun checks stay named as unrun: hardware playback and focus behavior, release
signing, store submission and review, and any cross-platform acceptance matrix
that has not been executed inside the last month are NOT RUN, and no passing
test here is evidence that they passed.

Fresh history. This repository's history starts from the selected current tree;
it does not carry the private lineage's commits, issues, pull requests, Actions
logs, artifacts, environments or secrets. Publication is a copy-out, not a move:
production services, DNS, store listings, signing credentials and the private
coordination repositories are unchanged by publication, and nothing here
authorizes touching them.

Secrets and security posture. The selected tree and every new revision were
scanned with pinned Gitleaks (redacted output, inline suppressions disabled, no
`.gitleaks.toml` and no `.gitleaksignore`), with a supplemental hygiene audit,
and by hand; all three reported no credential in this repository's history. That
is a measured result about this history, not a security certification and not a
proof that no secret exists. Secret scanning and push protection are checked
after visibility changes. Any credential found in a private ancestor is rotated
at its issuer, because deleting a file is not rotation.

Dependency and notice posture: dependency alerts are enabled and were clear of
open high/critical advisories at publication; collected third-party license texts
are in `THIRD-PARTY-LICENSES.json` with declared metadata in
`DEPENDENCY-LICENSE-INVENTORY.json`. Both are inventories, not legal clearance.
Anyone redistributing compiled builds owns the binary-distribution notices,
source-offer duties and vendor SDK terms for their own release.

On the Free GitHub plan, private branch protection cannot be enforced on a
private repository and private vulnerability reporting was not available while
these repositories were private; both are re-checked as public, and none of that
is represented as a merged-code guarantee.

## Repository-specific limits

Local verification on 2026-11-10: all 328 unit/contract test files pass (3,147
tests), all three Vite builds and local diagnostic packages pass, and the
two-pass package reproducibility gate passes. Three private-production workflow
contracts were replaced with no-deployment/no-publication source-distribution
contracts; runtime tests remain in the full suite. The current local changes
are not represented as a new hosted CI result.

Generated example art is documented; first-party ownership, third-party/vendor
rights, registered store branding, physical-device behavior, store certification
and final licensing authority remain unresolved. Diagnostic packages are not
certified vendor-store releases.

Publication requires exact-tree security and manual privacy review, classified
historical findings, code/asset ownership, third-party notices, dependency
vulnerability triage and appropriate local tests/builds.

Qualified software-licensing counsel must finalize the licensor identity, church
eligibility, commercial restriction, share-back duties, contributor agreement and
service/support terms. Drafts grant no rights and are not described as airtight.

CI for untrusted contributions is read-only and cannot deploy. Supported GitHub
security protections and a private reporting channel must be checked. Do not copy
production credentials into GitHub variables. Preparing source does not authorize
production migration, signing, store submission or credential rotation. Unrun
device/store checks stay NOT RUN. Keep candidates private until gates pass.
