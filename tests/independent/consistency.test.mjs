import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIndependentWorker, passwordHash } from '../../independent/auth.mjs';
import { OwnerAuthority } from '../../independent/authority.mjs';
import { authorityModel } from './authority-model.mjs';
const origin='https://map.example.invalid';
async function fixture() {
  const config={MAP_AUTH_GENERATION:'1',MAP_OWNER_SALT:'synthetic-generation-salt',MAP_OWNER_PASSWORD_HASH:await passwordHash('synthetic-password','synthetic-generation-salt')};
  const model=authorityModel(config);
  function ingress(generation='1') {
    let calls=0;const env={MAP_ORIGIN:origin,MAP_AUTH_GENERATION:generation,MAP_AUTHORITY:model.namespace};
    const worker=createIndependentWorker({fetch:async()=>{calls++;return new Response('private');}});
    const fetch=(p,init={})=>worker.fetch(new Request(origin+p,init),env,{});
    return {env,fetch,get calls(){return calls;},login:(password='synthetic-password')=>fetch('/auth/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})})};
  }
  return {config,model,ingress};
}
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
test('three ingress isolates share committed sessions and logout revocation across authority restart',async()=>{
  const f=await fixture();const a=f.ingress(),b=f.ingress(),c=f.ingress();
  const token=cookie(await a.login());
  for(const worker of [a,b,c])assert.equal((await worker.fetch('/api/status',{headers:{cookie:token}})).status,200);
  f.model.restart();assert.equal((await b.fetch('/api/status',{headers:{cookie:token}})).status,200);
  assert.equal((await c.fetch('/auth/logout',{method:'POST',headers:{origin,cookie:token}})).status,303);
  f.model.restart();
  for(const worker of [a,b,c])assert.equal((await worker.fetch('/api/status',{headers:{cookie:token}})).status,401);
  assert.equal(JSON.stringify([...f.model.store.values()]).includes(token.split('=')[1]),false);
});
test('parallel login attempts reserve the global budget; restart cannot reset it',async()=>{
  const f=await fixture();const ingress=[f.ingress(),f.ingress(),f.ingress()];
  const responses=await Promise.all(Array.from({length:12},(_,i)=>ingress[i%3].login('wrong')));
  assert.equal(responses.filter(r=>r.status===401).length,5);assert.equal(responses.filter(r=>r.status===429).length,7);
  f.model.restart();assert.equal((await ingress[0].login()).status,429);
});
test('credential rotation requires monotonic generation; previous sessions and stale workers stay rejected after restart',async()=>{
  const f=await fixture();const old=f.ingress();const oldCookie=cookie(await old.login());
  const changed={...f.config,MAP_OWNER_SALT:'synthetic-rotated-salt',MAP_OWNER_PASSWORD_HASH:await passwordHash('synthetic-new-password','synthetic-rotated-salt')};
  // Silent password/hash replacement without a generation bump fails closed.
  f.model.restart(changed);assert.equal((await old.fetch('/api/status',{headers:{cookie:oldCookie}})).status,503);
  const rotated={...changed,MAP_AUTH_GENERATION:'2'};f.model.restart(rotated);const current=f.ingress('2');
  assert.equal((await current.fetch('/api/status',{headers:{cookie:oldCookie}})).status,401);
  assert.equal((await old.fetch('/api/status',{headers:{cookie:oldCookie}})).status,503);
  const freshCookie=cookie(await current.login('synthetic-new-password'));f.model.restart(rotated);
  assert.equal((await current.fetch('/api/status',{headers:{cookie:freshCookie}})).status,200);
  // Model a stale authority binary/config resuming against durable generation 2.
  const stale=new OwnerAuthority(f.model.state,f.config);
  const r=await stale.fetch(new Request('https://map-auth.internal/verify',{method:'POST',body:JSON.stringify({generation:1,token:oldCookie.split('=')[1]})}));assert.equal(r.status,503);
});
test('authority/storage failures cannot authenticate, issue cookies or claim logout success',async()=>{
  const f=await fixture();const worker=f.ingress();const oldCookie=cookie(await worker.login());const before=worker.calls;
  f.model.failStorage(true);
  for(const request of [()=>worker.fetch('/api/status',{headers:{cookie:oldCookie}}),()=>worker.login(),()=>worker.fetch('/auth/logout',{method:'POST',headers:{origin,cookie:oldCookie}})]){
    const r=await request();assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('cache-control'),'no-store');
  }
  assert.equal(worker.calls,before);
  f.model.failStorage(false);assert.equal((await worker.fetch('/api/status',{headers:{cookie:oldCookie}})).status,200);
  worker.env.MAP_AUTHORITY={idFromName:()=>'',get:()=>({fetch:async()=>{throw Error('synthetic authority outage');}})};
  assert.equal((await worker.fetch('/api/status',{headers:{cookie:oldCookie}})).status,503);
});

test('malformed persisted state fails closed instead of resetting sessions or throttle',async()=>{
  const f=await fixture();const worker=f.ingress();await worker.login();
  const record=f.model.store.get('owner');record.attempts.count='invalid';
  const r=await worker.fetch('/api/status');assert.equal(r.status,503);assert.equal(worker.calls,0);
  assert.equal(f.model.store.get('owner').attempts.count,'invalid');
});
