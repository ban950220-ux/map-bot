import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIndependentWorker, passwordHash } from '../../independent/auth.mjs';
import { authorityModel } from './authority-model.mjs';
const origin = 'https://map.example.invalid';
async function fixture() {
  const seen = [];
  const env = { MAP_AUTH_GENERATION:'1',MAP_ORIGIN: origin, MAP_OWNER_SALT: 'synthetic-salt-only', MAP_OWNER_PASSWORD_HASH: await passwordHash('synthetic-owner-password', 'synthetic-salt-only'),
    ASSETS: { async fetch(req) { return new Response(new URL(req.url).pathname, { headers:{'Cache-Control':'public, max-age=3600'} }); } },
  };
  const model=authorityModel(env);env.MAP_AUTHORITY=model.namespace;const store=model.store;
  const worker = createIndependentWorker({ async fetch(req) { seen.push(req); return new Response('private result'); } });
  const fetch = (p='/',init={}) => worker.fetch(new Request(origin+p,init),env,{});
  const login = (password='synthetic-owner-password',headers={}) => fetch('/auth/login', { method:'POST', headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',...headers}, body:new URLSearchParams({password}) });
  return {env,store,seen,fetch,login};
}
test('owner login, protected app, no identity/cookie forwarding, logout and replay rejection',async()=>{
  const f=await fixture();
  assert.equal((await f.fetch('/')).headers.get('location'),'/auth/login');
  assert.equal((await f.fetch('/api/status')).status,401);
  assert.equal((await f.login('wrong')).status,401);
  const r=await f.login(); assert.equal(r.status,303);
  assert.match(r.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Strict/);
  const cookie=r.headers.get('set-cookie').split(';')[0];
  const authed=await f.fetch('/',{headers:{cookie}}); assert.equal(authed.status,200);
  assert.equal(authed.headers.get('cache-control'),'no-store');
  assert.equal(f.seen[0].headers.get('x-map-owner'),'verified-owner'); assert.equal(f.seen[0].headers.get('cookie'),null);
  assert.equal((await f.fetch('/auth/logout',{method:'GET',headers:{cookie}})).status,405);
  const out=await f.fetch('/auth/logout',{method:'POST',headers:{cookie,origin}});
  assert.equal(out.status,303); assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.fetch('/api/status',{headers:{cookie}})).status,401);
});
test('reject forged identity, missing/wrong origin, expired/tampered/duplicate sessions and unconfigured auth',async()=>{
  const f=await fixture();
  for(const headers of [{'oai-authenticated-user-id':'owner'},{'x-map-owner':'verified-owner'},{'sec-fetch-site':'cross-site'}]) assert.ok([400,403].includes((await f.fetch('/api/status',{headers})).status));
  assert.equal((await f.fetch('/auth/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:'password='+'x'.repeat(2048)})).status,413);
  assert.equal((await f.login(undefined,{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await f.fetch('/auth/login',{method:'POST'})).status,403);
  assert.equal((await f.fetch('/api/status',{headers:{cookie:'__Host-map-session=forged'}})).status,401);
  const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  assert.equal((await f.fetch('/api/status',{headers:{cookie:cookie+'; '+cookie}})).status,401);
  const record=f.store.get('owner');record.sessions.forEach(s=>{s.expires=1;});
  assert.equal((await f.fetch('/api/status',{headers:{cookie}})).status,401);
  delete f.env.MAP_OWNER_PASSWORD_HASH; assert.equal((await f.fetch('/')).status,503);
});
test('public install resources have no-store; login throttles; auth stays within configured origin',async()=>{
  const f=await fixture();
  for(const p of ['/manifest.webmanifest','/icon-192.png','/icon-512.png','/sw.js']) {const r=await f.fetch(p); assert.equal(r.status,200); assert.equal(r.headers.get('cache-control'),'no-store');}
  for(let i=0;i<5;i++) assert.equal((await f.login('wrong')).status,401);
  assert.equal((await f.login()).status,429);
  f.env.MAP_ORIGIN='https://different.invalid';assert.equal((await f.fetch('/auth/login')).status,403);
});
