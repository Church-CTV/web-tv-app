# Web TV source candidate

Questions about this software: [open an issue](issues) - anyone with a GitHub account may, no approval and no fee. Permissions, commercial licensing, sales and support: [SUPPORT.md](SUPPORT.md). License: Church CTV Community Source License 1.0 ([LICENSE](LICENSE)), and what it does not claim is in [LICENSING-STATUS.md](LICENSING-STATUS.md).

This is a multi-workspace TypeScript application for webOS, Tizen and Vizio.
It is public source under the license in `LICENSE`, not a store-ready release.

## Local development

Use Node 24 and npm. Run `npm ci --ignore-scripts --no-audit --no-fund`,
`npm test`, and `npm run build`. Individual builds are
`npm run build:webos`, `npm run build:tizen`, and `npm run build:vizio`.
Build output is under each platform's `dist/`. CI uses a hosted runner,
read-only repository permissions, and the complete unit/contract suite, builds,
local packaging and reproducibility gate. Synthetic channel profiles and feeds
replace live fixtures. The three historical privileged-deployment workflow
contracts now test the portable distribution's opposite invariant: no signing,
customer deployment or publication from CI. Runtime tests remain included.

## Configuration and secrets

Fresh startup and recovery use `http://localhost:3000`, not a customer server.
On a TV, localhost refers to the TV itself. The existing `ctv_server_config`
storage entry accepts a JSON object with `baseUrl` and positive `timeout`;
startup validates the URL before making requests. Configure an HTTPS server
under your control before expecting remote content. Server-delivered versioned
client profiles are validated before application; see
`core/src/server-config/ClientConfig.ts`. This candidate has no public setup UI
for provisioning that entry, and a complete build-time profile generator is not
included. Do not put credentials into profiles, source, or browser storage.
Signing credentials and store accounts belong in platform-vendor tooling, not
this tree. CI requires no deployment secrets.

No giving destination or QR artwork is bundled. webOS can render a validated
explicit `givingUrl` passed to its settings renderer, but the app does not
currently provision one. Vizio accepts a validated explicit `givingUrl` storage
value; unconfigured instances have no donation link. Tizen displays an
unconfigured message.
Never use customer data or images as defaults.

## Packaging and omissions

Platform metadata contains placeholder identities, not registered store IDs.
Customer artwork, QR images, fonts, vendor SDKs, signed packages, private captures
and live-server fixtures are omitted. Pinned geometric launcher/splash examples
are generated from repository code; see `assets/ASSET-PROVENANCE.md`. Replace
example branding and identities with appropriately licensed inputs before store
submission. `npm run package:local` creates unsigned Tizen/Vizio archives and a
diagnostic webOS fallback; `npm run repro` rebuilds and compares all three.
See `docs/reproducible-packages.md` for prerequisites and accepted differences.
Store signing, package installation, physical-device behavior and certification
have not been verified. Local Tizen device tooling requires an explicit target
and signing profile; CI never calls it. No Vizio vendor upload is supplied.

Dependencies are listed in `package-lock.json`; that inventory is not a
third-party notice or license clearance. `THIRD-PARTY-LICENSES.json`,
`DEPENDENCY-LICENSE-INVENTORY.json` and `assets/ASSET-PROVENANCE.md` record the
production, build-tool and generated-asset positions, as inventories rather than
clearance. Toolchain compatibility on physical TVs, vendor signing and store
certification remain NOT RUN. Publishing this source changes no store listing and
no live channel.
## License

This repository is licensed under the **Church CTV Community Source License,
Version 1.0** in `LICENSE` - source available, not OSI open source. In short: an
eligible church may run, modify and deploy it for its own worship and ministry
with no license fee, no channel or viewer cap and no obligation to buy hosting;
a church may hire ordinary technical help and use ordinary infrastructure;
anyone may build and run it locally to evaluate it or prepare a contribution;
and independent commercial operation, resale, white-label products and competing
managed hosting need separate rights from the owner. Deployed modifications carry
a share-back duty (section 7.2). Commercial and self-hosting licensing, and
church-eligibility confirmation, go to `dominick253@gmail.com`. Third-party
components keep their own licenses and notices, which are recorded but not
replaced by this license.

## Questions

Open an issue in this repository. Anyone may. Tell us the revision, the platform
and version, and what you expected versus what happened. Please keep credentials,
member or viewer data, customer names, private hostnames and unpatched security
problems out of public issues: security reports use the **Report a vulnerability**
form on the Security tab, and money, contract or permission matters go to
`dominick253@gmail.com`. There is no response-time promise; see `SUPPORT.md`.

