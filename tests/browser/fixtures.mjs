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
    const blocked = [], consoleErrors = [];
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
    page.on('pageerror', error => consoleErrors.push(error.message));
    await page.goto(h.url);
    await expect(page.getByRole('button', { name: '주변 장소 비교', exact: true })).toBeEnabled();
    try { await provide(page); }
    finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('safe-network-summary', { body: JSON.stringify({
          api: h.api.map(({path, status, aborted}) => ({path, status, aborted})),
          upstream: h.state.calls.map(({op, id}) => ({op, id})), blocked, consoleErrors,
        }), contentType: 'application/json' });
      }
      expect(blocked, 'browser external requests must fail closed').toEqual([]);
      expect(h.state.blocked, 'no unexpected server upstream (including Google)').toEqual([]);
      expect(h.api.filter(e => e.path === '/api/store-parking' && !e.probe), 'active flow must never call store-parking').toEqual([]);
      expect(h.errors).toEqual([]);
      expect(consoleErrors).toEqual([]);
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
