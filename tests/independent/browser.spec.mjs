import { test, expect } from '@playwright/test';
import { createIndependentHarness, syntheticPassword } from './harness.mjs';
import { gate } from '../browser/upstream.mjs';
import { installMapSdk } from '../browser/map-sdk.mjs';
import { search, complete } from '../browser/fixtures.mjs';
let h;
test.beforeEach(async()=>{h=await createIndependentHarness();});
test.afterEach(async()=>{await h.close();expect(h.errors).toEqual([]);expect(h.state.blocked).toEqual([]);});
async function login(page,context) {
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===h.url)return route.continue();
    if(u.origin==='https://oapi.map.naver.com'&&u.pathname==='/openapi/v3/maps.js')return route.fulfill({contentType:'text/javascript',body:`(${installMapSdk.toString()})()`});
    throw new Error('Unexpected browser external request: '+u.hostname);
  });
  await page.goto(h.url);await expect(page).toHaveURL(h.url+'/auth/login');
  await page.getByLabel('소유자 비밀번호').fill(syntheticPassword);await page.getByRole('button',{name:'로그인',exact:true}).click();
  await expect(page.getByRole('button',{name:'주변 장소 비교',exact:true})).toBeEnabled();
}
test('real independent Worker: login, search, CSV, install/back, network-only SW, logout and browser back',async({page,context})=>{
  await login(page,context);
  await search(page);await complete(page);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/CSV/}).click();await downloadPromise;
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller!==null)).toBe(true);
  await page.getByRole('link',{name:'앱 설치 안내'}).click();await expect(page.getByRole('heading',{name:'가까운 한 끼 앱 설치'})).toBeVisible();
  await page.goBack();await expect(page.getByRole('button',{name:'주변 장소 비교',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>caches.keys())).toEqual([]);
  const copied=(await context.cookies()).find(c=>c.name==='__Host-map-session');expect(copied.httpOnly).toBe(true);expect(copied.secure).toBe(true);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page).toHaveURL(h.url+'/auth/login');
  const probe=await context.request.get(h.url+'/api/status',{headers:{cookie:`${copied.name}=${copied.value}`}});expect(probe.status()).toBe(401);
  await page.goBack();await expect(page.getByLabel('소유자 비밀번호')).toBeVisible();
});
test('anonymous manifest and icons parse; actual Worker denies forged headers, cross-origin and unauthenticated API',async({request})=>{
  const r=await request.get(h.url+'/manifest.webmanifest');expect(r.status()).toBe(200);expect(r.headers()['content-type']).toContain('application/manifest+json');
  const m=await r.json();expect(m.display).toBe('standalone');expect(m.start_url).toBe('/');expect(m.scope).toBe('/');expect(m.id).toBe('/');
  for(const icon of m.icons){const ir=await request.get(h.url+icon.src);expect(ir.status()).toBe(200);expect(ir.headers()['content-type']).toBe('image/png');const b=await ir.body();expect(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`).toBe(icon.sizes);}
  expect((await request.get(h.url+'/api/status')).status()).toBe(401);
  expect((await request.get(h.url+'/api/status',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':'forged@example.invalid'}})).status()).toBe(400);
  expect((await request.get(h.url+'/api/status',{headers:{'x-map-owner':'verified-owner'}})).status()).toBe(400);
  expect((await request.post(h.url+'/auth/login',{headers:{origin:'https://evil.invalid'},form:{password:syntheticPassword}})).status()).toBe(403);
});
test('mobile widths and authenticated reload preserve the usable app',async({page,context})=>{
  await login(page,context);
  for(const width of [360,390,430,768,1200]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  // Exact cancellation/retry UI semantics are also covered by the unchanged Sites suite.
  await search(page);await complete(page);
  await page.reload();await expect(page.getByRole('button',{name:'주변 장소 비교',exact:true})).toBeEnabled();
});

test('independent session boundary preserves cancellation and explicit retry',async({page,context})=>{
  await login(page,context);
  const g=gate();h.state.holdRoutes={ids:[5,6,7,8],gate:g};
  await search(page);await expect.poll(()=>h.state.calls.filter(c=>c.op==='route').length).toBe(8);
  await expect(page.locator('.search-context')).toContainText('경로 성공 4곳');
  await page.getByRole('button',{name:'조회 중단',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('중단');
  g.release();h.state.holdRoutes=null;await expect.poll(()=>h.state.active).toBe(0);
  await page.getByRole('button',{name:'중단 지점부터 이어서 조회'}).click();await complete(page);
  expect(h.state.peak).toBeLessThanOrEqual(4);
});
