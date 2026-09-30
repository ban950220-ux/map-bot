import { readFile } from 'node:fs/promises';
import { test, expect, search, complete, checkpoint, CHECKPOINT } from './fixtures.mjs';
import { OTHER_ORIGIN, gate } from './upstream.mjs';

test('A normal search, actual API routes, map selection and zero-call interactions', async ({ app: page, harness: h }) => {
  await expect(page.getByRole('tab', { name: '주변 장소 찾기', exact: true })).toHaveAttribute('aria-selected', 'true');
  await search(page); await complete(page);
  await expect(page.locator('.place-card')).toHaveCount(5);
  await expect(page.locator('.place-card').first()).toContainText('1분');
  await expect(page.locator('.place-card').first()).toContainText('도로 16.0km');
  await expect(page.locator('.place-footer').first()).toContainText('실시간 교통 반영');
  await expect(page.locator('.place-footer').first()).toContainText('직선');
  const map = page.getByRole('region', { name: '출발지와 후보 목적지 지도' });
  await expect(map.locator('.destination-marker')).toHaveCount(6);
  await expect(map.locator('[data-polyline]')).toHaveCount(1);
  expect(await page.locator('.nearby-list').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('.map-panel')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(h.state.calls.filter(c => c.op === 'route')).toHaveLength(15);
  expect(h.state.peak).toBe(4);
  expect(h.api.filter(e => e.path === '/api/nearby-routes').map(e => e.body.candidates.length)).toEqual([4, 4, 4, 3]);
  const before = h.state.calls.length, apiBefore = h.api.length;
  await page.getByRole('tab', { name: '도로거리순', exact: true }).click();
  await expect(page.locator('.place-card').first()).toContainText('테스트 카페 1');
  await page.locator('.place-select').nth(1).click();
  await expect(page.locator('.map-selection')).toContainText('테스트 카페 2');
  await map.getByRole('button', { name: 'C 테스트 카페 3', exact: true }).click();
  await expect(page.locator('.place-select').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(map.locator('[data-polyline]')).toHaveAttribute('data-polyline', /127\.4006/);
  await map.getByRole('button', { name: '테스트 지도 이동' }).click();
  await page.getByRole('tab', { name: '추천순', exact: true }).click();
  await expect(page.getByText(/시간 80% \+ 거리 20%/)).toBeVisible();
  expect(h.state.calls.length).toBe(before); expect(h.api.length).toBe(apiBefore);
});

test('B direct brand match excludes nearer generic cafes from the route pool', async ({ app: page, harness: h }) => {
  await search(page, '스타벅스'); await complete(page, 3);
  await expect(page.locator('.place-card')).toHaveCount(3);
  for (const name of await page.locator('.place-card h3').allTextContents()) expect(name).toMatch(/^스타벅스/);
  expect(h.state.calls.filter(c => c.op === 'route').map(c => c.id).sort()).toEqual([4, 5, 6]);
});

test('C ambiguous origin requires an explicit keyboard choice', async ({ app: page, harness: h }) => {
  await search(page, '카페', '모호한 공공장소');
  const choices = page.getByRole('group', { name: '출발 장소 선택' });
  await expect(choices.getByRole('button')).toHaveCount(2);
  expect(h.state.calls.filter(c => c.op === 'places' || c.op === 'route')).toEqual([]);
  await choices.getByRole('button', { name: /테스트 공공장소 2/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '주변 장소 비교', exact: true }).click();
  await complete(page);
  expect(h.state.calls.find(c => c.op === 'places')).toMatchObject({ x: OTHER_ORIGIN.x, y: OTHER_ORIGIN.y });
  expect(h.state.calls.filter(c => c.op === 'route').every(c => c.start === `${OTHER_ORIGIN.x},${OTHER_ORIGIN.y}`)).toBe(true);
});

test('D no POI replaces old results; one candidate remains usable', async ({ app: page }) => {
  await search(page); await complete(page);
  await search(page, '없는장소'); await complete(page, 0);
  await expect(page.locator('.place-card')).toHaveCount(0);
  await expect(page.locator('.map-panel')).toHaveCount(0);
  await expect(page.getByText('비교할 수 있는 경로가 없습니다.', { exact: false })).toBeVisible();
  await search(page, '한곳'); await complete(page, 1);
  await expect(page.locator('.place-card')).toHaveCount(1);
});

test('E/F partial 12/15 results survive and resume retries only the 3 failures', async ({ app: page, harness: h }) => {
  h.state.failures = new Set([3, 7, 11]);
  await search(page);
  await expect(page.locator('.search-context')).toContainText('경로 성공 12곳');
  await expect(page.locator('.failures summary')).toContainText('3곳');
  await expect(page.locator('.place-card')).toHaveCount(5);
  const cp = await checkpoint(page);
  expect(cp.progress.snapshot.completed).toBe(false);
  await page.locator('.failures summary').click();
  await expect(page.locator('.failures p')).toHaveCount(3);
  expect(cp.progress.snapshot.candidates.filter(c => c.route)).toHaveLength(12);
  expect(cp.progress.snapshot.candidates.filter(c => c.routeError)).toHaveLength(3);
  h.state.failures.clear();
  const before = h.state.calls.filter(c => c.op === 'route').length;
  await page.getByRole('button', { name: '중단 지점부터 이어서 조회' }).click();
  await complete(page);
  expect(h.state.calls.filter(c => c.op === 'route').slice(before).map(c => c.id).sort((a,b)=>a-b)).toEqual([3, 7, 11]);
  expect(new Set((await checkpoint(page)).progress.snapshot.candidates.map(c => c.id)).size).toBe(15);
  await expect(page.locator('.failures')).toHaveCount(0);
});

test('G/H abort preserves 4 successes; resume merges remaining candidates without duplicates', async ({ app: page, harness: h }) => {
  const g = gate(); h.state.holdRoutes = { ids: [5, 6, 7, 8], gate: g };
  await search(page);
  await expect.poll(() => h.state.calls.filter(c => c.op === 'route').length).toBe(8);
  await expect(page.locator('.search-context')).toContainText('경로 성공 4곳');
  await page.getByRole('button', { name: '조회 중단', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('중단');
  expect((await checkpoint(page)).progress.snapshot.candidates).toHaveLength(4);
  await expect.poll(() => h.api.some(e => e.path === '/api/nearby-routes' && e.aborted)).toBe(true);
  g.release(); h.state.holdRoutes = null;
  await expect.poll(() => h.state.active).toBe(0);
  const before = h.api.length;
  await page.getByRole('button', { name: '중단 지점부터 이어서 조회' }).click(); await complete(page);
  const resumed = h.api.slice(before).filter(e => e.path === '/api/nearby-routes').flatMap(e => e.body.candidates.map(c=>c.id));
  expect(resumed).toHaveLength(11); expect(resumed.some(id => ['kakao:1','kakao:2','kakao:3','kakao:4'].includes(id))).toBe(false);
  expect(new Set((await checkpoint(page)).progress.snapshot.candidates.map(c=>c.id)).size).toBe(15);
});

for (const status of [401, 429]) test(`I fatal ${status} stops later batches and never offers immediate resume`, async ({ app: page, harness: h }) => {
  h.state.fatal = status; await search(page);
  await expect(page.getByRole('alert')).toContainText('API 인증 또는 이용 한도');
  await expect(page.locator('.search-context')).toContainText('경로 성공 4곳');
  expect(h.state.calls.filter(c => c.op === 'route')).toHaveLength(8);
  await expect(page.getByRole('button', { name: '중단 지점부터 이어서 조회' })).toHaveCount(0);
  await expect(page.getByText(/설정 또는 한도를 확인한 뒤 새로 검색/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/설정 또는 한도를 확인한 뒤 새로 검색/)).toBeVisible();
  await expect(page.getByRole('button', { name: '중단 지점부터 이어서 조회' })).toHaveCount(0);
});

test('J Search A response arrives after B completes without corrupting B or checkpoint', async ({ app: page, harness: h }) => {
  const g = gate(); h.state.holdPlaces = { query: '검색A', gate: g };
  await search(page, '검색A');
  await expect.poll(() => h.state.calls.some(c => c.op === 'places' && c.query === '검색A')).toBe(true);
  await expect(page.getByLabel('어떤 장소를 찾으세요?', {exact:true})).toBeDisabled();
  // The UI deliberately serializes searches. Abort A, start B while A's server response is still held.
  await page.getByRole('button', { name: '조회 중단', exact:true }).click();
  await expect(page.getByRole('button', {name:'주변 장소 비교',exact:true})).toBeEnabled();
  await search(page, '검색B'); await complete(page);
  const before = await checkpoint(page);
  g.release(); h.state.holdPlaces = null;
  await expect.poll(() => h.state.placesFinished.includes('검색A')).toBe(true);
  await expect.poll(() => h.api.find(e => e.path === '/api/places' && e.body.query === '검색A')?.aborted).toBe(true);
  await expect(page.getByRole('heading', {name:'검색B 비교 결과'})).toBeVisible();
  await expect(page.locator('.place-card').first()).toContainText('검색B');
  expect(await checkpoint(page)).toEqual(before);
});

test('K condition edits explicitly label the old result', async ({ app: page, harness: h }) => {
  await search(page); await complete(page); const before=h.state.calls.length;
  await page.getByLabel('어떤 장소를 찾으세요?',{exact:true}).fill('한식');
  await expect(page.getByText(/아래 내용은 이전 조건의 결과/)).toBeVisible();
  await expect(page.getByRole('heading',{name:'카페 비교 결과'})).toBeVisible();
  expect(h.state.calls.length).toBe(before);
});

for (const field of ['address','radius','count','expand']) test(`L mismatched ${field} checkpoint cannot resume a different search`, async ({app:page,harness:h})=>{
  const g=gate(); h.state.holdRoutes={ids:[5,6,7,8],gate:g}; await search(page);
  await expect.poll(()=>h.state.calls.filter(c=>c.op==='route').length).toBe(8);
  await page.getByRole('button',{name:'조회 중단',exact:true}).click();
  await expect(page.getByRole('button',{name:'중단 지점부터 이어서 조회'})).toBeVisible();
  g.release(); h.state.holdRoutes=null;
  await page.evaluate(({key,field,address})=>{const cp=JSON.parse(sessionStorage.getItem(key));cp.input[field]=field==='address'?address:field==='radius'?3000:field==='count'?3:true;sessionStorage.setItem(key,JSON.stringify(cp));},{key:CHECKPOINT,field,address:OTHER_ORIGIN.address});
  const before=h.api.length; await page.reload();
  const resume=page.getByRole('button',{name:'중단 지점부터 이어서 조회'});
  if(await resume.count()) await resume.click(); else await page.getByRole('button',{name:'주변 장소 비교',exact:true}).click();
  await complete(page);
  expect(h.api.slice(before).filter(e=>e.path==='/api/places')).toHaveLength(1);
  expect(h.api.slice(before).filter(e=>e.path==='/api/nearby-routes').flatMap(e=>e.body.candidates)).toHaveLength(15);
});

test('M completed checkpoint restores without resume or route geometry; expired checkpoint is ignored',async({app:page,harness:h})=>{
  await search(page);await complete(page);const cp=await checkpoint(page),before=h.state.calls.length;
  expect(cp.progress.snapshot.candidates.every(c=>c.route.path.length===0)).toBe(true);
  expect(JSON.stringify(cp)).not.toMatch(/google-places|parkingOptions/);
  await page.reload();await expect(page.getByText('최근 비교 결과를 복원했습니다.')).toBeVisible();
  await complete(page);await expect(page.getByRole('button',{name:'중단 지점부터 이어서 조회'})).toHaveCount(0);
  expect(h.state.calls.length).toBe(before);
  await page.evaluate(key=>{const cp=JSON.parse(sessionStorage.getItem(key));cp.savedAt=Date.now()-31*60*1000;sessionStorage.setItem(key,JSON.stringify(cp));},CHECKPOINT);
  await page.reload();await expect(page.locator('.place-card')).toHaveCount(0);
});

test('parking and real CSV download retain PK6, unknown store parking, and no Google content',async({app:page,harness:h})=>{
  await search(page,'주차 가능한 카페');await complete(page);
  expect(h.state.calls.find(c=>c.op==='places')).toMatchObject({query:null,category:'CE7'});
  expect(h.state.calls.filter(c=>c.op==='pk6')).toHaveLength(1);
  const cp=await checkpoint(page);
  expect(cp.progress.snapshot.candidates.every(c=>c.storeParking.status==='unknown'&&c.nearbyParking.status==='found')).toBe(true);
  await expect(page.locator('.place-card').first()).toContainText('매장 자체 주차와 별개');
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'상위 결과 CSV 다운로드'}).click();
  const download=await pending;const csv=await readFile(await download.path(),'utf8');
  expect(csv).toContain('"자동차분","도로km","직선km","매장주차","인근주차장"');
  expect(csv).toContain('"1.0","16.00"');expect(csv).toContain('"확인 필요","테스트 인근 공영주차장"');
  expect(csv).not.toMatch(/google|rating|review|business.status|opening.hours|평점|리뷰|영업/i);
});
