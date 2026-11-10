/**
 * Isolated reference service for contract and E2E tests.
 *
 * This is NOT a production server. It serves the contract fixtures from
 * tests/fixtures/contracts/ at the real API paths, so the client can test
 * against a real HTTP server without mocking in-process.
 *
 * Run with: npm run reference-service
 * Default port: 9090 (override with --port=N)
 */

import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../tests/fixtures/contracts');

interface Route {
  method: string;
  path: string;
  fixture: string;
  status: number;
}

/**
 * Route table: API path -> fixture file.
 * Only the paths the client actually calls are implemented.
 * Unknown paths return 404.
 */
const routes: Route[] = [
  // Feed
  { method: 'GET', path: '/feed', fixture: 'positive-feed.json', status: 200 },
  // Health
  { method: 'GET', path: '/health', fixture: 'positive-health.json', status: 200 },
  // Schedule
  { method: 'GET', path: '/api/schedule', fixture: 'positive-schedule.json', status: 200 },
  // Analytics
  {
    method: 'POST',
    path: '/api/analytics',
    fixture: 'positive-analytics-export.json',
    status: 200,
  },
  // Heartbeat
  {
    method: 'POST',
    path: '/api/heartbeat',
    fixture: 'positive-heartbeat-response.json',
    status: 200,
  },
  // Crash
  { method: 'POST', path: '/api/crash', fixture: 'positive-crash-clear.json', status: 200 },
];

export function createServer() {
  return {
    listen(port: number) {
      const http = import('node:http');
      http.then(({ createServer: createHttpServer }) => {
        const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
          try {
            handleRequest(req, res);
          } catch (err) {
            console.error('Reference service error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal error', detail: String(err) }));
          }
        });

        server.listen(port, '127.0.0.1', () => {
          console.log(`[ref-service] listening on 127.0.0.1:${port}`);
          console.log(`[ref-service] fixtures: ${FIXTURES_DIR}`);
        });
      });
    },
  };
}

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const method = req.method || 'GET';
  const path = (req.url || '/').split('?')[0];

  const route = routes.find((r) => r.method === method && r.path === path);

  if (!route) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', path, method }));
    return;
  }

  // Read and serve fixture
  const fixturePath = resolve(FIXTURES_DIR, route.fixture);
  if (!existsSync(fixturePath)) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'fixture missing', path: fixturePath }));
    return;
  }

  const body = readFileSync(fixturePath, 'utf-8');
  res.writeHead(route.status, { 'Content-Type': 'application/json' });
  res.end(body);
}

// Only auto-start when executed directly, not when imported
if (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1] === import.meta.url) {
  const server = createServer();
  const portArg = process.argv.find((a) => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 9090;
  server.listen(port);
}
