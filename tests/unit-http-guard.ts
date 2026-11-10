/**
 * Unit-suite network guard.
 *
 * The unit suite is hermetic: a test that wants a server stubs one. This guard
 * makes that rule enforced instead of assumed - jsdom hands out a real `fetch`,
 * so an unstubbed request would leave the machine and point at a customer
 * server. A channel that ships a hardcoded feed host makes that mistake easy to
 * miss, and a green suite would then mean "the production channel answered".
 *
 * Tests that need a response call `vi.stubGlobal('fetch', ...)`, which replaces
 * this guard for the duration of the test.
 */

const CONFIG_PATH = /\/api\/v2\/config$/;

const guard = async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input);
  if (CONFIG_PATH.test(url)) {
    const body = JSON.stringify({ error: 'unit-test: no channel profile installed' });
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: (name: string) => (name.toLowerCase() === 'etag' ? null : null) },
      json: async () => JSON.parse(body),
      text: async () => body,
    } as Response;
  }
  throw new Error(`unit-test-network-blocked: unstubbed fetch to ${url}`);
};

globalThis.fetch = guard as unknown as typeof fetch;
