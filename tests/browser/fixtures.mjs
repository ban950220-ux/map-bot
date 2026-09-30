import { test as base, expect } from '@playwright/test';
import { createHarness } from './harness.mjs';
import { installMapSdk } from './map-sdk.mjs';
import { ORIGIN } from './upstream.mjs';

export const CHECKPOINT = 'nearby-comparison-checkpoint-v4';
export const test = base.extend({
  harness: async ({}, provide) => {
    const h = await createHarness(); try { await provide(h); } finally { await h.close(); }
  },
  app: async ({ page, context, harness: h }, provide, testInfo) => {
    const blocked = [], consoleErrors = [], pageErrors = [];
    h.expectedConsoleFailures = [];
    h.browserRequests = [];
    page.on('request', request => {
      const url = new URL(request.url());
      h.browserRequests.push({ host: url.hostname, path: url.pathname });
    });
    await context.addCookies([{ name: 'fixture-owner', value: '1', url: h.url }]);
    await context.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.origin === h.url) return route.continue();
      if (u.origin === 'https://oapi.map.naver.com' && u.pathname === '/openapi/v3/maps.js') {
        return route.fulfill({ contentType: 'text/javascript', body: `(${installMapSdk.toString()})()` });
      }
      blocked.push({ host: u.hostname, path: u.pathname }); await route.abort();
    });
    // Browser API shim only. Executes the application's registered WebMCP tool.
    await page.addInitScript(() => {
      window.__testTools = {};
      Object.defineProperty(document, 'modelContext', { configurable: true, value: {
        registerTool(tool, options) {
          window.__testTools[tool.name] = tool;
          options.signal.addEventListener('abort', () => { if (window.__testTools[tool.name] === tool) delete window.__testTools[tool.name]; });
        },
      } });
    });
    // Never persist arbitrary console text: it may contain credentials or PII.
    page.on('pageerror', () => pageErrors.push('uncaught-page-error'));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const location = message.location();
      const url = location.url ? new URL(location.url) : null;
      const allowed = h.expectedConsoleFailures.find(rule => rule.remaining > 0
        && url?.pathname === rule.path && message.text() === rule.message
        && (url.origin === h.url || url.origin === 'https://oapi.map.naver.com'));
      if (allowed) { allowed.remaining--; return; }
      consoleErrors.push({ kind: 'unexpected-console-error', source: url?.pathname?.startsWith('/api/') ? 'local-api' : 'script-or-resource' });
    });
    await page.goto(h.url);
    await expect(page.getByRole('button', { name: '주변 장소 비교', exact: true })).toBeEnabled();
    try { await provide(page); }
    finally {
      if (testInfo.status !== testInfo.expectedStatus || blocked.length || consoleErrors.length || pageErrors.length || h.errors.length || h.state.blocked.length) {
        await testInfo.attach('safe-network-summary', { body: JSON.stringify({
          api: h.api.map(({path, status, aborted}) => ({path, status, aborted})),
          upstream: h.state.calls.map(({op, id}) => ({op, id})), blocked: blocked.map(({host}) => ({host})), consoleErrors, pageErrors,
        }), contentType: 'application/json' });
      }
      expect(blocked, 'browser external requests must fail closed').toEqual([]);
      expect(h.state.blocked, 'no unexpected server upstream (including Google)').toEqual([]);
      expect(h.api.filter(e => e.path === '/api/store-parking' && !e.probe), 'active flow must never call store-parking').toEqual([]);
      expect(h.errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(h.expectedConsoleFailures.map(rule => rule.remaining), 'each narrow console exception must actually occur').toEqual(h.expectedConsoleFailures.map(() => 0));
    }
  },
});
export { expect };
export async function search(page, query = '카페', address = ORIGIN.address) {
  await page.getByLabel('출발지', { exact: true }).fill(address);
  await page.getByLabel('어떤 장소를 찾으세요?', { exact: true }).fill(query);
  await page.getByLabel('후보가 부족하면 반경 확대').uncheck();
  await page.getByRole('button', { name: '주변 장소 비교', exact: true }).click();
}
export async function complete(page, n = 15) {
  await expect(page.locator('.search-context')).toContainText(`경로 성공 ${n}곳`);
  await expect(page.locator('.search-context')).toContainText('최종 순위');
  await expect(page.getByRole('button', { name: '주변 장소 비교', exact: true })).toBeEnabled();
}
export async function checkpoint(page) { return page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), CHECKPOINT); }

// Compare every user-visible async output, not only the result heading.
export async function comparisonState(page) {
  return page.evaluate(key => ({
    query: document.querySelector('#nearby-query').value,
    cards: [...document.querySelectorAll('.place-card')].map(el => el.textContent),
    markers: [...document.querySelectorAll('.destination-marker')].map(el => ({ label: el.getAttribute('aria-label'), selected: el.classList.contains('selected'), position: el.dataset.markerPosition })),
    path: document.querySelector('[data-polyline]')?.getAttribute('data-polyline'),
    selected: document.querySelector('.map-selection')?.textContent,
    pressed: [...document.querySelectorAll('.place-select')].map(el => el.getAttribute('aria-pressed')),
    progress: document.querySelector('.progress-block')?.textContent,
    busy: document.querySelector('.nearby-results').getAttribute('aria-busy'),
    context: document.querySelector('.search-context')?.textContent,
    error: document.querySelector('[role=alert]')?.textContent,
    checkpoint: JSON.parse(sessionStorage.getItem(key)),
  }), CHECKPOINT);
}
