import { test, expect, search, complete, checkpoint } from './fixtures.mjs';
import { ORIGIN, OTHER_ORIGIN, docs, gate } from './upstream.mjs';

test('NAVER directions link retains searched origin after edits and uses the next search origin', async ({ app: page, harness: h }) => {
  await search(page); await complete(page);
  const link = page.locator('.place-card').first().getByRole('link', { name: '네이버 길찾기 열기' });
  const first = await link.getAttribute('href');
  const destination = await page.locator('.place-card').first().locator('h3').textContent();
  expect(first).toMatch(/^https:\/\/map\.naver\.com\/p\/directions\//);
  expect(first).toContain(`${encodeURIComponent(ORIGIN.address)},,ADDRESS_POI`);
  expect(first).toContain(`${encodeURIComponent(destination)},,ADDRESS_POI`);
  const before = h.state.calls.length;
  await page.getByLabel('출발지', { exact: true }).fill(OTHER_ORIGIN.address);
  await expect(page.getByText(/아래 내용은 이전 조건의 결과/)).toBeVisible();
  expect(await link.getAttribute('href')).toBe(first);
  expect(h.state.calls.length).toBe(before);
  await page.getByRole('button', { name: '주변 장소 비교', exact: true }).click();
  await complete(page);
  const second = await link.getAttribute('href');
  expect(second).toContain(`${encodeURIComponent(OTHER_ORIGIN.address)},,ADDRESS_POI`);
  expect(second).not.toBe(first);
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)' }));
  await page.reload();
  const appLink = page.locator('.place-card').first().getByRole('link', { name: '네이버 앱에서 길찾기' });
  await expect(appLink).toBeVisible();
  await expect(appLink).toHaveAttribute('href', /^intent:\/\/route\/car\?/);
  expect(await appLink.getAttribute('href')).toContain(`sname=${encodeURIComponent(OTHER_ORIGIN.address)}`);
  await expect(page.locator('.place-card').first().getByRole('link', { name: '네이버 길찾기 열기' })).toHaveAttribute('href', /^https:\/\/map\.naver\.com\/p\/directions\//);
  expect(h.state.blocked).toEqual([]);
});

test('WebMCP contract shim executes registered nearby and legacy tools through real APIs', async ({ app: page, harness: h }) => {
  await expect.poll(() => page.evaluate(() => Object.keys(window.__testTools))).toContain('compare_nearby_places');
  const result = await page.evaluate(address => window.__testTools.compare_nearby_places.execute({ address, query: '주차 가능한 카페', expand: false }), ORIGIN.address);
  await complete(page);
  expect(result).toMatchObject({ completed: true, compared: 15, query: '주차 가능한 카페' });
  expect(result.results).toHaveLength(5);
  expect(result.results[0]).toMatchObject({ trafficDuration: 60000, drivingDistance: 16000, storeParking: { status: 'unknown' }, nearbyParking: { status: 'found' } });
  expect(result.results[0].straightDistance).toBeGreaterThan(0);
  expect(result.results.every(r => !r.route && r.checkedAt)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/google|rating|review|business.status|opening.hours/i);
  const before = h.state.calls.length;
  expect(await page.evaluate(async () => { try { await window.__testTools.compare_nearby_places.execute({ address:'bad',query:'카페',radius:123 }); return false; } catch { return true; } })).toBe(true);
  expect(h.state.calls.length).toBe(before);
  await page.getByRole('tab', { name: '저장 장소 / 주소 경로', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__testTools))).toContain('compare_live_driving_times');
  const legacy = await page.evaluate(({origin,destination}) => window.__testTools.compare_live_driving_times.execute({ mode:'direct',origin,destination }), { origin:ORIGIN.address,destination:OTHER_ORIGIN.address });
  expect(legacy).toMatchObject({ completed:true,count:1,failures:[] });
  expect(legacy.results[0]).toMatchObject({ minutes:10,distanceKm:5 });
  expect(JSON.stringify(legacy)).not.toMatch(/google|rating|review|business.status|opening.hours/i);
  await expect(page.locator('.winner')).toContainText('10분');
});

test('legacy direct and saved-store UI flows remain usable; expanding results makes no calls', async ({app:page,harness:h}) => {
  await page.getByRole('tab',{name:'저장 장소 / 주소 경로',exact:true}).click();
  await page.getByLabel('출발지 주소',{exact:true}).fill(ORIGIN.address);
  await page.getByRole('tab',{name:'직접 입력',exact:true}).click();
  await page.getByLabel('도착지 주소',{exact:true}).fill(OTHER_ORIGIN.address);
  await page.getByRole('button',{name:'자동차 경로 조회',exact:true}).click();
  await expect(page.locator('.report-context')).toContainText('1곳 성공');
  await expect(page.locator('.winner')).toContainText('10분');
  await page.getByRole('tab',{name:'양꼬치집 비교',exact:true}).click();
  await page.getByRole('button',{name:'소요시간 비교',exact:true}).click();
  await expect(page.locator('.report-context')).toContainText('56곳 성공');
  expect(h.state.peak).toBeLessThanOrEqual(4);
  const before=h.state.calls.length;
  await page.getByRole('button',{name:'나머지 46곳 모두 보기'}).click();
  await expect(page.locator('.rank-list li')).toHaveCount(55);
  expect(h.state.calls.length).toBe(before);
});

test('map SDK failure leaves list, ETA, road distance, sorting and CSV usable', async ({app:page,context,harness:h}) => {
  h.expectedConsoleFailures.push({ path:'/openapi/v3/maps.js',message:'Failed to load resource: net::ERR_FAILED',remaining:1 });
  const failScript=route=>route.abort();
  await context.route('https://oapi.map.naver.com/**',failScript);
  await search(page);await complete(page);
  await expect(page.locator('.map-status')).toContainText('지도');
  await expect(page.locator('.place-card')).toHaveCount(5);
  await expect(page.locator('.place-card').first()).toContainText('도로 16.0km');
  const before=h.state.calls.length;
  await page.getByRole('tab',{name:'도로거리순',exact:true}).click();
  await expect(page.locator('.place-card').first()).toContainText('테스트 카페 1');
  await expect(page.getByRole('button',{name:'상위 결과 CSV 다운로드'})).toBeEnabled();
  expect(h.state.calls.length).toBe(before);
  await context.unroute('https://oapi.map.naver.com/**',failScript);
  await page.getByRole('button',{name:'지도 다시 불러오기'}).click();
  await expect(page.locator('.destination-marker')).toHaveCount(6);
  expect(h.state.calls.length).toBe(before);
});

test('blocked session storage does not prevent connection or search', async ({app:page,context}) => {
  await context.addInitScript(() => {
    for (const method of ['getItem','removeItem']) {
      const original=Storage.prototype[method];
      Storage.prototype[method]=function(key,...rest) {
        if (key === 'nearby-comparison-checkpoint-v4') throw new DOMException('Storage blocked','SecurityError');
        return original.call(this,key,...rest);
      };
    }
  });
  await page.reload();
  await expect(page.getByRole('button',{name:'주변 장소 비교',exact:true})).toBeEnabled();
  await search(page); await complete(page);
});

test('switching tabs preserves a comparison and blocks a second paid route stream', async ({app:page,harness:h}) => {
  const hold=gate(); h.state.holdRoutes={ids:[1,2,3,4],gate:hold};
  try {
    await search(page);
    await expect.poll(()=>h.state.calls.filter(c=>c.op==='route').length).toBe(4);
    await page.getByRole('tab',{name:'저장 장소 / 주소 경로'}).click();
    await page.getByLabel('출발지 주소').fill(ORIGIN.address);
    await page.getByRole('button',{name:'소요시간 비교'}).click();
    await expect(page.getByRole('alert')).toContainText('다른 경로 조회가 진행 중입니다');
    expect(h.api.filter(e=>e.path==='/api/compare')).toHaveLength(0);
    expect(h.state.peak).toBe(4);
    expect(h.state.calls.filter(c=>c.op==='route')).toHaveLength(4);
  } finally {hold.release(); h.state.holdRoutes=null;}
  await expect.poll(()=>h.state.calls.filter(c=>c.op==='route').length).toBe(15);
  await expect(page.locator('.nearby-results')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'소요시간 비교'}).click();
  await expect.poll(()=>h.state.calls.filter(c=>c.op==='route').length).toBe(71);
  await expect(page.getByRole('button',{name:'소요시간 비교'})).toBeEnabled();
  expect(h.state.peak).toBe(4);
});

test('all candidate failures remain recoverable and restore after refresh', async ({app:page,harness:h})=>{
  h.state.failures=new Set(docs.map(d=>Number(d.id)));
  await search(page);
  await expect(page.locator('.failures summary')).toContainText('15곳');
  await expect(page.locator('.place-card')).toHaveCount(0);
  expect((await checkpoint(page)).progress.snapshot.completed).toBe(false);
  await page.reload();
  await expect(page.getByRole('button',{name:'중단 지점부터 이어서 조회'})).toBeVisible();
  h.state.failures.clear();
  await page.getByRole('button',{name:'중단 지점부터 이어서 조회'}).click();await complete(page);
});

test('browser network failure preserves successful checkpoint and retries pending batch',async({app:page,context,harness:h})=>{
  h.expectedConsoleFailures.push({ path:'/api/nearby-routes',message:'Failed to load resource: net::ERR_FAILED',remaining:1 });
  let batches=0;
  await context.route('**/api/nearby-routes',route=>++batches===2?route.abort():route.continue());
  await search(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.search-context')).toContainText('경로 성공 4곳');
  await page.getByRole('button',{name:'중단 지점부터 이어서 조회'}).click();await complete(page);
});

test('progress is announced and cancellation controls are keyboard accessible',async({app:page,harness:h})=>{
  const g=gate();h.state.holdRoutes={ids:[1,2,3,4],gate:g};await search(page);
  await expect(page.locator('.progress-block[role=status]')).toContainText('후보별 자동차 경로');
  await expect(page.getByRole('progressbar',{name:'후보 자동차 경로 조회 진행률'})).toHaveCount(1);
  await expect(page.getByRole('region',{name:'주변 장소 비교 결과'})).toHaveAttribute('aria-busy','true');
  await expect(page.locator('.nearby-results')).toHaveAttribute('aria-busy','true');
  const stop=page.getByRole('button',{name:'조회 중단',exact:true});await stop.focus();await expect(stop).toBeFocused();await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('중단');
  await expect(page.locator('.nearby-results')).toHaveAttribute('aria-busy','false');
});

test('synthetic GPS permission granted uses coordinates without geocoding',async({app:page,context,harness:h})=>{
  await context.grantPermissions(['geolocation']);await context.setGeolocation({longitude:ORIGIN.x,latitude:ORIGIN.y,accuracy:12});
  await page.getByRole('button',{name:'현재 위치 사용'}).click();await expect(page.getByLabel('출발지',{exact:true})).toHaveValue('현재 위치');
  await page.getByLabel('어떤 장소를 찾으세요?',{exact:true}).fill('카페');
  await page.getByRole('button',{name:'주변 장소 비교',exact:true}).click();await complete(page);
  expect(h.state.calls.some(c=>c.op==='geocode')).toBe(false);
  expect(h.state.calls.find(c=>c.op==='places')).toMatchObject({x:ORIGIN.x,y:ORIGIN.y});
});

for(const mode of ['denied','timeout','unsupported'])test(`GPS ${mode} permits manual address fallback`,async({app:page})=>{
  await page.evaluate(mode=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:mode==='unsupported'?undefined:{getCurrentPosition(_success,fail){fail({code:mode==='denied'?1:3});}}}),mode);
  await page.getByRole('button',{name:'현재 위치 사용'}).click();
  await expect(page.getByRole('alert')).toContainText('주소를 직접 입력');
  await search(page);await complete(page);
});

test('credentialed manifest/icons and auth/API boundary contract (not production authentication)',async({app:page,context,harness:h})=>{
  const link=page.locator('link[rel=manifest]');await expect(link).toHaveAttribute('crossorigin','use-credentials');
  const manifestPath=await link.getAttribute('href');
  const response=await context.request.get(h.url+manifestPath);expect(response.status()).toBe(200);
  const manifest=await response.json();expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512')).toBe(true);
  for(const icon of manifest.icons){const response=await context.request.get(h.url+icon.src);expect(response.status()).toBe(200);const png=await response.body();const [w,hh]=icon.sizes.split('x').map(Number);expect(png.readUInt32BE(16)).toBe(w);expect(png.readUInt32BE(20)).toBe(hh);}
  for(const size of ['192x192','512x512'])expect(manifest.icons.some(i=>i.sizes===size)).toBe(true);
  const before=h.state.calls.length;
  const retired=await context.request.post(h.url+'/api/store-parking',{data:{}});expect(retired.status()).toBe(410);
  h.api.findLast(e=>e.path==='/api/store-parking').probe=true;
  const forbidden=await context.request.post(h.url+'/api/places',{headers:{'sec-fetch-site':'cross-site'},data:{}});expect(forbidden.status()).toBe(403);
  expect(h.state.calls.length).toBe(before);
  await context.clearCookies();
  expect((await context.request.get(h.url+manifestPath)).status()).toBe(401);
  expect((await context.request.get(h.url)).status()).toBe(401);
  const spoof=await context.request.post(h.url+'/api/places',{headers:{'oai-authenticated-user-id':'attacker'},data:{}});expect(spoof.status()).toBe(401);
});
