import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build, transformSync } from 'esbuild';
import { Miniflare, Response as WorkerResponse } from 'miniflare';
import { createHarness } from '../tests/browser/harness.mjs';
import { ORIGIN, OTHER_ORIGIN, docs, gate } from '../tests/browser/upstream.mjs';

const coordinatorBundle = (await build({ entryPoints: ['lib/comparisonCoordinator.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral' })).outputFiles[0].text;
const { beginComparison } = await import('data:text/javascript;base64,' + Buffer.from(coordinatorBundle).toString('base64'));
const endNearby = beginComparison();
assert.throws(() => beginComparison(), /다른 경로 조회/);
endNearby();
beginComparison()();
console.log('PASS browser-page coordinator: second comparison blocked until release');

async function workerFor(source, outboundService) {
  const script = (await build({ stdin: { contents: source, resolveDir: process.cwd(), sourcefile: 'audit-check.ts', loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] })).outputFiles[0].text;
  return new Miniflare({ modules: true, script, compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], bindings: { KAKAO_REST_API_KEY: 'fixture-kakao' }, ...(outboundService ? { outboundService } : {}) });
}

const placeSource = `import { searchNearby } from './services/maps/placeSearch'; export default { async fetch() { return Response.json(await searchNearby('스타벅스', { x:127.4,y:37.27,address:'synthetic' },5000,5,false)); } };`;
const pages = [];
const placeWorker = await workerFor(placeSource, async request => {
  const page = Number(new URL(request.url).searchParams.get('page')); pages.push(page);
  const doc = (id, name) => ({ id: String(id), place_name: name, x: String(127.4 + id * .0001), y: '37.27', address_name: 'synthetic', road_address_name: 'synthetic', category_name: '카페', phone: '' });
  const documents = page === 1 ? Array.from({ length: 15 }, (_, index) => doc(index + 1, `카페 ${index + 1}`)) : [doc(16, '스타벅스 이천점')];
  return WorkerResponse.json({ meta: { is_end: page === 2, total_count: 16, pageable_count: 16 }, documents });
});
try {
  const data = await (await placeWorker.dispatchFetch('http://test.local')).json();
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(data.candidates.map(item => item.name), ['스타벅스 이천점']);
  console.log('PASS keyword pagination: later direct match found within two pages');
} finally { await placeWorker.dispose(); }

const fatalSource = `import { searchNearby } from './services/maps/placeSearch'; import { MapsError } from './lib/naver'; export default { async fetch() { const calls=[]; const candidate={id:'kakao:1',name:'카페 1',address:'synthetic',latitude:37.27,longitude:127.401,category:'카페',source:'kakao-local'}; const provider={searchPlaces:async (_q,_o,r)=>{calls.push(r);if(r>1000) throw new MapsError('fixture quota',429,true);return {candidates:[candidate],requestedRadius:r,searchedRadius:r,expanded:false,cached:false,limited:false,checkedAt:new Date().toISOString(),warnings:[]};}};try{await searchNearby('카페',{x:127.4,y:37.27,address:'synthetic'},1000,5,true,undefined,provider);return Response.json({calls,stopped:false});}catch(e){return Response.json({calls,stopped:e.fatal,status:e.status});}}};`;
const fatalWorker = await workerFor(fatalSource);
try {
  const data = await (await fatalWorker.dispatchFetch('http://test.local')).json();
  assert.deepEqual(data, { calls: [1000, 3000], stopped: true, status: 429 });
  console.log('PASS fatal expansion: quota error stops before routing');
} finally { await fatalWorker.dispose(); }

const parkingSource = `import { searchNearby } from './services/maps/placeSearch'; export default { async fetch() { try { await searchNearby('주차 가능한 카페',{x:127.4,y:37.27,address:'synthetic'},5000,5,false); return Response.json({stopped:false}); } catch(e) { return Response.json({stopped:e.fatal,status:e.status}); } } };`;
let parkingCalls = 0;
const parkingWorker = await workerFor(parkingSource, async request => {
  const url = new URL(request.url);
  if (url.searchParams.get('category_group_code') === 'PK6') { parkingCalls++; return WorkerResponse.json({ error: 'fixture denied' }, { status: 401 }); }
  return WorkerResponse.json({ meta: { is_end: true, total_count: 1, pageable_count: 1 }, documents: [{ id: '1', place_name: '카페 1', x: '127.401', y: '37.27', address_name: 'synthetic', road_address_name: 'synthetic', category_name: '카페', phone: '' }] });
});
try {
  const data = await (await parkingWorker.dispatchFetch('http://test.local')).json();
  assert.deepEqual(data, { stopped: true, status: 502 });
  assert.equal(parkingCalls, 1);
  console.log('PASS parking permission: fatal auth error is not reduced to a warning');
} finally { await parkingWorker.dispose(); }

const harness = await createHarness();
try {
  const candidates = docs.slice(0, 4).map(place => ({ id: `kakao:${place.id}`, name: place.place_name, address: place.road_address_name, latitude: Number(place.y), longitude: Number(place.x), category: place.category_name, source: 'kakao-local' }));
  const post = (path, body) => fetch(harness.url + path, { method: 'POST', headers: { cookie: 'fixture-owner=1', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const hold = gate(); harness.state.holdRoutes = { ids: [1, 2, 3, 4], gate: hold };
  const nearby = post('/api/nearby-routes', { origin: ORIGIN, candidates });
  try {
    for (let attempt = 0; attempt < 100 && harness.state.calls.filter(call => call.op === 'route').length < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(harness.state.calls.filter(call => call.op === 'route').length, 4);
    const overlapping = await post('/api/compare', { mode: 'stores', origin: ORIGIN, ids: [1, 2, 3, 4] });
    assert.equal(overlapping.status, 503);
    assert.equal(harness.state.calls.filter(call => call.op === 'route').length, 4);
  } finally { hold.release(); harness.state.holdRoutes = null; }
  assert.equal((await nearby).status, 200);
  assert.equal(harness.state.peak, 4);
  assert.deepEqual(harness.state.blocked, []);
  console.log('PASS shared route limit: overlapping request rejected, peak 4 within one Worker isolate');
} finally { await harness.close(); }

const clientBundle = (await build({ entryPoints: ['lib/nearby-client.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' })).outputFiles[0].text;
const { runNearbyComparison } = await import('data:text/javascript;base64,' + Buffer.from(clientBundle).toString('base64'));
const recoveryHarness = await createHarness();
try {
  const stores = JSON.parse(readFileSync('lib/stores.json', 'utf8'));
  const heldIds = stores.slice(0, 4).map(store => Math.round((store.x - ORIGIN.x) / .0002));
  const hold = gate(); recoveryHarness.state.holdRoutes = { ids: heldIds, start: `${ORIGIN.x},${ORIGIN.y}`, gate: hold };
  const request = (path, body, signal) => fetch(recoveryHarness.url + path, { method: 'POST', headers: { cookie: 'fixture-owner=1', 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  const legacy = request('/api/compare', { mode: 'stores', origin: ORIGIN, ids: [1, 2, 3, 4] });
  for (let attempt = 0; attempt < 100 && recoveryHarness.state.calls.filter(call => call.op === 'route').length < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(recoveryHarness.state.calls.filter(call => call.op === 'route').length, 4);
  const candidates = docs.slice(0, 8).map(place => ({ id: `kakao:${place.id}`, name: place.place_name, address: place.road_address_name, latitude: Number(place.y), longitude: Number(place.x), category: place.category_name, source: 'kakao-local' }));
  const input = { address: OTHER_ORIGIN.address, location: OTHER_ORIGIN, query: '카페', radius: 5000, count: 5, expand: false };
  const search = { candidates, requestedRadius: 5000, searchedRadius: 5000, expanded: false, cached: false, limited: false, checkedAt: new Date().toISOString(), warnings: [] };
  let routeBatches = 0;
  const post = async (path, body, signal) => {
    if (path === '/api/places') return search;
    assert.equal(path, '/api/nearby-routes'); routeBatches++;
    const response = await request(path, body, signal);
    assert.equal(response.status, 200); return response.json();
  };
  let partial;
  try {
    partial = await runNearbyComparison(input, new AbortController().signal, () => {}, post);
    assert.equal(partial.completed, false);
    assert.equal(routeBatches, 1);
    assert.equal(partial.candidates.filter(candidate => candidate.routeErrorBusy).length, 4);
    assert.equal(partial.candidates.some(candidate => candidate.routeErrorFatal), false);
    assert.equal(recoveryHarness.state.calls.filter(call => call.op === 'route').length, 4);
  } finally { hold.release(); recoveryHarness.state.holdRoutes = null; }
  assert.equal((await legacy).status, 200);
  const resumed = await runNearbyComparison(input, new AbortController().signal, () => {}, post, partial);
  assert.equal(resumed.completed, true);
  assert.equal(routeBatches, 3);
  assert.equal(recoveryHarness.state.peak, 4);
  console.log('PASS nearby busy recovery: stops one batch, preserves resume, completes on explicit retry');
} finally { await recoveryHarness.close(); }

const timeoutHarness = await createHarness();
try {
  const hold = gate(); timeoutHarness.state.holdRoutes = { ids: [3], gate: hold };
  const candidates = docs.map(place => ({ id: `kakao:${place.id}`, name: place.place_name, address: place.road_address_name, latitude: Number(place.y), longitude: Number(place.x), category: place.category_name, source: 'kakao-local' }));
  const input = { address: ORIGIN.address, location: ORIGIN, query: '카페', radius: 5000, count: 5, expand: false };
  const search = { candidates, requestedRadius: 5000, searchedRadius: 5000, expanded: false, cached: false, limited: false, checkedAt: new Date().toISOString(), warnings: [] };
  const post = async (path, body, signal) => {
    if (path === '/api/places') return search;
    assert.equal(path, '/api/nearby-routes');
    const response = await fetch(timeoutHarness.url + path, { method: 'POST', headers: { cookie: 'fixture-owner=1', 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
    assert.equal(response.status, 200); return response.json();
  };
  try {
    const result = await runNearbyComparison(input, new AbortController().signal, () => {}, post);
    assert.equal(result.completed, false);
    assert.equal(result.candidates.filter(candidate => candidate.route).length, 14);
    assert.equal(result.candidates.filter(candidate => candidate.routeError).length, 1);
    assert.equal(result.candidates.filter(candidate => candidate.routeErrorBusy).length, 0);
    assert.deepEqual(timeoutHarness.api.filter(event => event.path === '/api/nearby-routes').map(event => event.body.candidates.length), [4, 4, 4, 3]);
    assert.equal(timeoutHarness.state.peak, 4);
    console.log('PASS one timeout: other 14 routes finish using remaining slots without busy');
  } finally { hold.release(); timeoutHarness.state.holdRoutes = null; }
} finally { await timeoutHarness.close(); }

const releasedHarness = await createHarness();
try {
  const candidates = docs.slice(0, 4).map(place => ({ id: `kakao:${place.id}`, name: place.place_name, address: place.road_address_name, latitude: Number(place.y), longitude: Number(place.x), category: place.category_name, source: 'kakao-local' }));
  const hold = gate(); releasedHarness.state.holdRoutes = { ids: [1, 2, 3, 4], start: `${ORIGIN.x},${ORIGIN.y}`, gate: hold };
  const post = (origin, signal) => fetch(releasedHarness.url + '/api/nearby-routes', { method: 'POST', headers: { cookie: 'fixture-owner=1', 'content-type': 'application/json' }, body: JSON.stringify({ origin, candidates }), signal });
  try {
    const controller = new AbortController();
    const canceled = post(ORIGIN, controller.signal).catch(() => null);
    for (let attempt = 0; attempt < 100 && releasedHarness.state.calls.filter(call => call.op === 'route').length < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(releasedHarness.state.calls.filter(call => call.op === 'route').length, 4);
    controller.abort(); await canceled;
  } finally { hold.release(); releasedHarness.state.holdRoutes = null; }
  for (let attempt = 0; attempt < 100 && releasedHarness.state.active > 0; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(releasedHarness.state.active, 0);
  const resumed = await post(OTHER_ORIGIN);
  const data = await resumed.json();
  assert.equal(data.candidates.filter(candidate => candidate.route).length, 4);
  assert.equal(releasedHarness.state.peak, 4);
  console.log('PASS abort-and-release: explicit resume succeeds immediately after upstream completion');
} finally { await releasedHarness.close(); }

const abortHarness = await createHarness();
try {
  const candidates = docs.slice(0, 4).map(place => ({ id: `kakao:${place.id}`, name: place.place_name, address: place.road_address_name, latitude: Number(place.y), longitude: Number(place.x), category: place.category_name, source: 'kakao-local' }));
  const hold = gate(); abortHarness.state.holdRoutes = { ids: [1, 2, 3, 4], start: `${ORIGIN.x},${ORIGIN.y}`, gate: hold };
  const post = (origin, signal) => fetch(abortHarness.url + '/api/nearby-routes', { method: 'POST', headers: { cookie: 'fixture-owner=1', 'content-type': 'application/json' }, body: JSON.stringify({ origin, candidates }), signal });
  try {
    const controller = new AbortController();
    const canceled = post(ORIGIN, controller.signal).catch(() => {});
    for (let attempt = 0; attempt < 100 && abortHarness.state.calls.filter(call => call.op === 'route').length < 4; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(abortHarness.state.calls.filter(call => call.op === 'route').length, 4);
    controller.abort(); await canceled;
    const later = await post(OTHER_ORIGIN);
    const data = await later.json();
    assert.equal(later.status, 200);
    assert.equal(data.candidates.filter(candidate => candidate.routeErrorBusy).length, 4);
    assert.equal(abortHarness.state.peak, 4);
    assert.equal(abortHarness.state.calls.filter(call => call.op === 'route').length, 4);
    console.log('PASS late-abort guard: B is recoverably busy while A upstream remains held; peak 4');
    await new Promise(resolve => setTimeout(resolve, 20500));
    const stillHeld = await post(OTHER_ORIGIN);
    const heldData = await stillHeld.json();
    assert.equal(heldData.candidates.filter(candidate => candidate.routeErrorBusy).length, 4);
    assert.equal(abortHarness.state.peak, 4);
    console.log('PASS held-after-20s guard: uncertain A still occupies four slots');
  } finally { hold.release(); abortHarness.state.holdRoutes = null; }
  // Recovery is bounded even if a canceled request context never resumes.
  await new Promise(resolve => setTimeout(resolve, 30100));
  const retried = await post(OTHER_ORIGIN);
  const retryData = await retried.json();
  assert.equal(retried.status, 200);
  assert.equal(retryData.candidates.filter(candidate => candidate.route).length, 4);
  assert.equal(abortHarness.state.peak, 4);
  console.log('PASS canceled-slot recovery: explicit retry succeeds after bounded lease');
} finally { await abortHarness.close(); }

const explorerSource = readFileSync('components/NearbyExplorer.tsx', 'utf8');
const checkpointBody = explorerSource.slice(explorerSource.indexOf('function loadCheckpoint()'), explorerSource.indexOf('\nexport default function NearbyExplorer()'));
const checkpointCode = transformSync(`const CHECKPOINT_KEY='fixture'; const CHECKPOINT_TTL=1800000; ${checkpointBody}; globalThis.auditLoad=loadCheckpoint;`, { loader: 'ts', format: 'cjs' }).code;
const checkpointContext = { Date, JSON, sessionStorage: { getItem() { throw new DOMException('denied', 'SecurityError'); }, removeItem() { throw new DOMException('denied', 'SecurityError'); } } };
vm.createContext(checkpointContext); vm.runInContext(checkpointCode, checkpointContext);
assert.equal(checkpointContext.auditLoad(), null);
console.log('PASS storage denial: checkpoint loading returns null');

const mapSource = readFileSync('components/NearbyMap.tsx', 'utf8');
const sdkBody = mapSource.slice(mapSource.indexOf('const browser ='), mapSource.indexOf('\nexport default function NearbyMap'));
const sdkCode = transformSync(`${sdkBody}\nglobalThis.auditLoadSdk=loadSdk;`, { loader: 'ts', format: 'cjs' }).code;
const scripts = [];
const sdkContext = { window: {}, setTimeout, clearTimeout, Error, document: { createElement: () => ({}), head: { appendChild(script) { scripts.push(script); queueMicrotask(() => { if (scripts.length === 1) script.onerror(); else { sdkContext.window.naver = { maps: { fixture: true } }; script.onload(); } }); } } } };
vm.createContext(sdkContext); vm.runInContext(sdkCode, sdkContext);
await assert.rejects(sdkContext.auditLoadSdk('fixture-public-id'));
assert.equal((await sdkContext.auditLoadSdk('fixture-public-id')).fixture, true);
assert.equal(scripts.length, 2);
console.log('PASS SDK retry: failed script followed by a fresh successful script');
