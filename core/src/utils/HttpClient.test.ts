/**
 * HttpClient tests — retry, timeout, error handling.
 */

import { describe, it, expect, vi } from 'vitest';
import { get, post } from './HttpClient';

describe('HttpClient', () => {
  describe('get', () => {
    it('fetches data from a URL', async () => {
      const mockResponse = { ok: true, status: 200, json: async () => ({ key: 'value' }) };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
      const result = await get('http://localhost/feed', { timeoutMs: 5000 });
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ key: 'value' });
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost/feed',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('retries on failure', async () => {
      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      });
      const result = await get('http://localhost/feed', { maxRetries: 3, retryBaseDelayMs: 10 });
      expect(result.status).toBe(200);
      expect(callCount).toBe(2);
    });
  });

  describe('post', () => {
    it('sends JSON data to a URL', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ received: true }),
      } as Response);
      const result = await post(
        'http://localhost/analytics',
        { event: 'screen_view' },
        { timeoutMs: 5000 }
      );
      expect(result.status).toBe(200);
    });
  });
});
