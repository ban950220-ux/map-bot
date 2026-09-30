import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { createUpstream } from './upstream.mjs';

// This gateway exists only in tests. It models Sites' trusted header boundary;
// production auth helpers and API handlers are used without modification.
export async function createHarness() {
  const upstream = createUpstream();
  const api = [], errors = [];
  const serverRoot = path.resolve('dist/server');
  const moduleFiles = (await readdir(serverRoot, { recursive: true }))
    .filter(file => /\.(?:m?js)$/.test(file) && file !== 'index.js');
  const worker = new Miniflare({
    modules: ['index.js', ...moduleFiles].map(file => ({ type: 'ESModule', path: path.join(serverRoot, file) })),
    modulesRoot: serverRoot,
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    cf: false, inspectorPort: undefined,
    bindings: { NAVER_MAPS_CLIENT_ID: 'fixture-id', NAVER_MAPS_CLIENT_SECRET: 'fixture-secret', KAKAO_REST_API_KEY: 'fixture-kakao' },
    outboundService: upstream.fetch,
  });
  await worker.ready;
  const clientRoot = path.resolve('dist/client');
  const server = createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) { res.writeHead(403).end(); return; }
      const authenticated = req.headers.cookie?.split(';').some(c => c.trim() === 'fixture-owner=1');
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (!name.startsWith('oai-') && value) headers.set(name, String(value));
      }
      if (authenticated) {
        headers.set('oai-authenticated-user-id', 'fixture-owner');
        headers.set('oai-authenticated-user-email', 'owner@example.invalid');
      }
      if (!authenticated && !url.pathname.startsWith('/api/')) { res.writeHead(401).end('Authentication required'); return; }
      if (req.method === 'GET') {
        const target = path.resolve(clientRoot, '.' + decodeURIComponent(url.pathname));
        if (target.startsWith(clientRoot + path.sep)) {
          try {
            const data = await readFile(target);
            const mime = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
            res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' }).end(data); return;
          } catch (e) { if (!['ENOENT', 'EISDIR'].includes(e.code)) throw e; }
        }
      }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const event = { path: url.pathname, aborted: false, status: null };
      if (url.pathname.startsWith('/api/')) {
        if (body.length) event.body = JSON.parse(body.toString());
        api.push(event);
      }
      controller.signal.addEventListener('abort', () => { event.aborted = true; });
      const response = await worker.dispatchFetch(`http://localhost${url.pathname}${url.search}`, {
        method: req.method, headers, ...(body.length ? { body } : {}), signal: controller.signal,
      });
      event.status = response.status;
      if (res.destroyed) return;
      const responseHeaders = Object.fromEntries(response.headers);
      delete responseHeaders['content-length']; delete responseHeaders['content-encoding'];
      res.writeHead(response.status, responseHeaders);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      if (controller.signal.aborted) return;
      errors.push(e.message); res.writeHead(500).end('Test gateway failed');
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}`, api, errors, ...upstream,
    async close() {
      upstream.state.holdRoutes?.gate.release(); upstream.state.holdPlaces?.gate.release();
      server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await worker.dispose();
    },
  };
}
