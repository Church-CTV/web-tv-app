/**
 * The version the Vizio app shows the viewer.
 *
 * WEB-010 (`tests/contract/version-alignment.test.ts`) pins this string to the
 * canonical version in the root `package.json`, which is also the number in
 * `manifest.json` and in the packaged `package-meta.json`. A screen may not
 * advertise a version no artifact carries: before this file existed the Vizio
 * settings line said `Version: 1.0.0` while the package was built as `0.1.0`,
 * and the app's own startup path said `0.1.0` - two answers on one screen.
 *
 * Tizen is deliberately different: `config.xml` carries Samsung's submission
 * version, which the same contract test keeps separate from the monorepo number.
 */
export const APP_VERSION = '0.1.0';
