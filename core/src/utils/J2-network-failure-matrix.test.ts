/**
 * J2 — Network failure matrix (J2a: HttpClient hardening)
 *
 * Contract under test:
 * - Transient failures (network, timeout, 408, 429, 5xx, parse) are retried
 *   with bounded exponential backoff and full jitter.
 * - Non-transient failures (4xx other than 408/429, external abort) fail
 *   immediately without retry.
 * - Errors are classified via HttpError.code so UI layers can render
 *   actionable, localized states.
 * - External AbortSignal cancels in-flight requests and pending backoffs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('J2a HttpClient — network failure matrix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const okResponse = () =>
    ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ payload: 'ok' }),
    }) as unknown as Response;

  const httpError = (status: number, statusText = '') =>
    ({
      ok: false,
      status,
      statusText,
      json: async () => ({}),
    }) as unknown as Response;

  describe('error classification', () => {
    it('classifies network failures (offline / DNS) with code network', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      const { get } = await import('./HttpClient');
      await expect(get('http://offline.example/feed', { maxRetries: 1 })).rejects.toMatchObject({
        code: 'network',
      });
    });

    it('classifies timeouts with code timeout', async () => {
      vi.useFakeTimers();
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = (init as RequestInit).signal as AbortSignal | undefined;
            signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted.');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      const { get } = await import('./HttpClient');
      const promise = get('http://slow.example/feed', { timeoutMs: 500, maxRetries: 1 });
      // Attach the rejection handler BEFORE advancing timers so the timeout
      // rejection is never observed as unhandled.
      const assertion = expect(promise).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(600);
      await assertion;
    });

    it('classifies HTTP status failures with code http and the status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(httpError(503, 'Service Unavailable'));

      const { get } = await import('./HttpClient');
      await expect(get('http://unavailable.example/feed', { maxRetries: 1 })).rejects.toMatchObject(
        { code: 'http', status: 503 }
      );
    });

    it('classifies malformed JSON with code parse', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      } as unknown as Response);

      const { get } = await import('./HttpClient');
      await expect(get('http://bad-json.example/feed', { maxRetries: 1 })).rejects.toMatchObject({
        code: 'parse',
      });
    });
  });

  describe('retry policy', () => {
    it('retries transient HTTP 5xx and recovers', async () => {
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        calls += 1;
        if (calls < 3) return httpError(502);
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const result = await get('http://flaky.example/feed', {
        maxRetries: 3,
        retryBaseDelayMs: 1,
        maxDelayMs: 2,
        random: () => 1,
      });

      expect(result.data).toEqual({ payload: 'ok' });
      expect(calls).toBe(3);
    });

    it('retries transient HTTP 429 and recovers', async () => {
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        calls += 1;
        if (calls === 1) return httpError(429);
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const result = await get('http://ratelimited.example/feed', {
        maxRetries: 2,
        retryBaseDelayMs: 1,
        maxDelayMs: 2,
        random: () => 1,
      });

      expect(result.data).toEqual({ payload: 'ok' });
      expect(calls).toBe(2);
    });

    it('retries network failures and recovers', async () => {
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const result = await get('http://flaky.example/feed', {
        maxRetries: 2,
        retryBaseDelayMs: 1,
        maxDelayMs: 2,
        random: () => 1,
      });

      expect(result.data).toEqual({ payload: 'ok' });
      expect(calls).toBe(2);
    });

    it('retries malformed JSON responses and recovers (partial response)', async () => {
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => {
              throw new SyntaxError('Unexpected end of JSON');
            },
          } as unknown as Response;
        }
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const result = await get('http://truncated.example/feed', {
        maxRetries: 2,
        retryBaseDelayMs: 1,
        maxDelayMs: 2,
        random: () => 1,
      });

      expect(result.data).toEqual({ payload: 'ok' });
      expect(calls).toBe(2);
    });

    it('does NOT retry non-transient HTTP 404', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(httpError(404));

      const { get } = await import('./HttpClient');
      await expect(get('http://missing.example/feed', { maxRetries: 3 })).rejects.toMatchObject({
        code: 'http',
        status: 404,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry non-transient HTTP 403 (auth)', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(httpError(403));

      const { get } = await import('./HttpClient');
      await expect(get('http://forbidden.example/feed', { maxRetries: 3 })).rejects.toMatchObject({
        code: 'http',
        status: 403,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('exhausts retries and rejects with the last transient error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(httpError(503));

      const { get } = await import('./HttpClient');
      await expect(
        get('http://down.example/feed', {
          maxRetries: 2,
          retryBaseDelayMs: 1,
          maxDelayMs: 2,
          random: () => 1,
        })
      ).rejects.toMatchObject({ code: 'http', status: 503 });
    });
  });

  describe('bounded exponential backoff with jitter', () => {
    it('caps each backoff delay at maxDelayMs', async () => {
      vi.useFakeTimers();
      const start = Date.now();
      const callTimes: number[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callTimes.push(Date.now() - start);
        if (callTimes.length < 4) throw new TypeError('offline');
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed', {
        maxRetries: 5,
        retryBaseDelayMs: 100,
        maxDelayMs: 300,
        random: () => 1,
      });
      for (let i = 0; i < 50 && vi.getTimerCount() > 0; i += 1) {
        await vi.advanceTimersByTimeAsync(1000);
      }
      await promise;

      // full jitter at random=1: delays are min(cap, base * 2^n) = 100, 200, 300
      expect(callTimes).toEqual([0, 100, 300, 600]);
    });

    it('applies full jitter (delay = random * bounded exponential)', async () => {
      vi.useFakeTimers();
      const start = Date.now();
      const callTimes: number[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callTimes.push(Date.now() - start);
        if (callTimes.length < 4) throw new TypeError('offline');
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed', {
        maxRetries: 5,
        retryBaseDelayMs: 100,
        maxDelayMs: 1000,
        random: () => 0.5,
      });
      for (let i = 0; i < 50 && vi.getTimerCount() > 0; i += 1) {
        await vi.advanceTimersByTimeAsync(1000);
      }
      await promise;

      // full jitter at random=0.5: delays are 0.5 * (100, 200, 400) = 50, 100, 200
      expect(callTimes).toEqual([0, 50, 150, 350]);
    });

    it('uses the default bounded backoff when none is configured', async () => {
      // With default settings (base 1s, cap 30s, maxRetries 2), the backoff
      // window for 2 retries is < 10s and must never exceed the 30s cap.
      vi.useFakeTimers();
      const start = Date.now();
      const callTimes: number[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callTimes.push(Date.now() - start);
        if (callTimes.length < 3) throw new TypeError('offline');
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed');
      for (let i = 0; i < 100 && vi.getTimerCount() > 0; i += 1) {
        await vi.advanceTimersByTimeAsync(1000);
      }
      await promise;

      expect(callTimes.length).toBe(3);
      const gaps = callTimes.slice(1).map((t, i) => t - callTimes[i]);
      for (const gap of gaps) {
        expect(gap).toBeLessThanOrEqual(30_000);
      }
    });
  });

  describe('external abort / cancellation', () => {
    it('classifies external abort with code abort and does not retry', async () => {
      const controller = new AbortController();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted.');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed', { signal: controller.signal });
      controller.abort();

      await expect(promise).rejects.toMatchObject({ code: 'abort' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('cancels immediately when already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const { get } = await import('./HttpClient');
      await expect(
        get('http://x.example/feed', { signal: controller.signal })
      ).rejects.toMatchObject({ code: 'abort' });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('aborts during backoff without waiting for the delay', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      let calls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        calls += 1;
        if (calls === 1) throw new TypeError('offline');
        return okResponse();
      });

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed', {
        maxRetries: 3,
        retryBaseDelayMs: 60_000,
        random: () => 1,
        signal: controller.signal,
      });
      await vi.advanceTimersByTimeAsync(1000);
      controller.abort();

      await expect(promise).rejects.toMatchObject({ code: 'abort' });
      expect(calls).toBe(1);
    });

    it('classifies in-flight external abort as abort and does not retry', async () => {
      const controller = new AbortController();
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal as AbortSignal | undefined;
            signal?.addEventListener('abort', () => {
              const err = new Error('The operation was aborted.');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );

      const { get } = await import('./HttpClient');
      const promise = get('http://x.example/feed', {
        maxRetries: 3,
        signal: controller.signal,
      });
      // Abort after the request is in flight, not before.
      setTimeout(() => controller.abort(), 5);

      await expect(promise).rejects.toMatchObject({ code: 'abort' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('classifies unknown non-Error rejections as network failures', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue('mystery failure');

      const { get } = await import('./HttpClient');
      await expect(get('http://x.example/feed', { maxRetries: 1 })).rejects.toMatchObject({
        code: 'network',
        message: 'mystery failure',
      });
    });

    it('classifies NetworkError transport failures with code network', async () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(networkError);

      const { get } = await import('./HttpClient');
      await expect(get('http://x.example/feed', { maxRetries: 1 })).rejects.toMatchObject({
        code: 'network',
      });
    });
  });

  describe('content-type header preservation', () => {
    it('sets Content-Type on JSON POST bodies when no headers given', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

      const { post } = await import('./HttpClient');
      await post('http://x.example/event', { a: 1 }, { maxRetries: 1 });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://x.example/event',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('preserves caller-provided headers on POST', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as unknown as Response);

      const { post } = await import('./HttpClient');
      await post(
        'http://x.example/event',
        { a: 1 },
        {
          maxRetries: 1,
          headers: { Authorization: 'Bearer test-token' },
        }
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://x.example/event',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });
  });
});
