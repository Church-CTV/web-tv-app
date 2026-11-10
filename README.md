# Web TV source candidate

This is a multi-workspace TypeScript application for webOS, Tizen and Vizio.
It is an incomplete public-source candidate, not a store-ready release.

## Local development

Use Node 24 and npm. Run `npm ci --ignore-scripts --no-audit --no-fund`,
`npm run test:focused`, and `npm run build`. Individual builds are
`npm run build:webos`, `npm run build:tizen`, and `npm run build:vizio`.
Build output is under each platform's `dist/`. CI uses a hosted runner,
read-only repository permissions, and these same focused tests and builds.
The broader suite is not yet a release gate: it includes tests that rely on
omitted assets and SDKs, and historical settings behavior. Synthetic channel profiles and feeds cover a subset of the omitted live fixtures.

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
currently provision one; Tizen and Vizio display an unconfigured message.
Never use customer data or images as defaults.

## Packaging and omissions

Platform metadata contains placeholder identities, not registered store IDs.
Launcher icons, splash images, QR images, fonts, vendor SDKs, signed packages,
private captures, and live-server fixtures are omitted. Provide appropriately
licensed platform-sized branding and verify metadata before packaging. Legacy
packaging scripts and their checks may reference omitted assets or tooling;
they are not part of the CI release path. Store signing, package installation,
device behavior, accessibility, and platform certification have not been
verified. The Vizio upload script and customer screenshot script are omitted.

Dependencies are listed in `package-lock.json`; that inventory is not a
third-party notice or license clearance. Source ownership, dependency and asset
rights, toolchain compatibility, and legal review remain publication blockers.
No claim of vendor certification or production readiness is made.
