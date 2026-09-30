import { test, expect, search, complete, checkpoint } from './fixtures.mjs';
import { gate } from './upstream.mjs';

for (const query of ['카페', '스타벅스', '주차 가능한 카페']) test(`Google zero-call guard: ${query}`, async ({ app: page, harness: h }) => {
  await search(page, query); await complete(page, query === '스타벅스' ? 3 : 15);
  expect(h.browserRequests.filter(r => r.host === 'places.googleapis.com')).toEqual([]);
  expect(h.browserRequests.filter(r => r.path === '/api/store-parking')).toEqual([]);
  expect(h.api.filter(r => r.path === '/api/store-parking')).toEqual([]);
  expect(h.state.blocked).toEqual([]);
  const counts = Object.fromEntries(['geocode', 'places', 'route', 'pk6'].map(op => [op, h.state.calls.filter(c => c.op === op).length]));
  expect(counts).toEqual({ geocode: 1, places: 1, route: query === '스타벅스' ? 3 : 15, pk6: query.startsWith('주차') ? 1 : 0 });
});

test('NAVER actual 18-second timeout remains candidate-specific and resumable', async ({ app: page, harness: h }) => {
  // No timer override or runtime seam: withhold one mock response until the
  // actual NAVER adapter deadline cancels it. Remaining routes must survive.
  const held = gate(); h.state.holdRoutes = { ids: [3], gate: held };
  await search(page);
  await expect(page.locator('.search-context')).toContainText('경로 성공 14곳', { timeout: 21000 });
  await expect(page.locator('.failures summary')).toContainText('1곳');
  await page.locator('.failures summary').click();
  await expect(page.locator('.failures')).toContainText('응답이 늦어');
  expect((await checkpoint(page)).progress.snapshot.completed).toBe(false);
  held.release(); h.state.holdRoutes = null;
  await expect.poll(() => h.state.finished).toBe(15);
  const before = h.api.length;
  await page.getByRole('button', { name: '중단 지점부터 이어서 조회' }).click(); await complete(page);
  expect(h.api.slice(before).filter(e => e.path === '/api/nearby-routes').flatMap(e => e.body.candidates.map(c => c.id))).toEqual(['kakao:3']);
});
