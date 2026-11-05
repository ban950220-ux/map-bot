import '../../scripts/sites-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { passwordHash } from '../../independent/auth.mjs';
// Miniflare's own local proxy accepts loopback Origins; keep that guard enabled.
const origin='http://127.0.0.1';
async function setup() {
  const directory=await mkdtemp(path.resolve('.sites-runtime/authority-runtime-'));
  const root=path.resolve('dist-independent/server');
  const files=(await readdir(root,{recursive:true})).filter(f=>/\.(?:m?js)$/.test(f)&&f!=='index.js');
  const modules=['index.js',...files].map(file=>({type:'ESModule',path:path.join(root,file)}));
  let mf;
  async function start(generation='1',workerGenerations=[generation,generation],password='synthetic-runtime-password') {
    if(mf)await mf.dispose();
    mf=new Miniflare({cf:false,durableObjectsPersist:directory,workers:[
      {name:'authority',modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
        bindings:{MAP_AUTH_GENERATION:generation,MAP_OWNER_SALT:'synthetic-runtime-salt',MAP_OWNER_PASSWORD_HASH:await passwordHash(password,'synthetic-runtime-salt')},
        durableObjects:{LOCAL_AUTH:{className:'OwnerAuthority',useSQLite:true}},outboundService:()=>{throw Error('No external network allowed');}},
      ...workerGenerations.map((g,i)=>({name:`ingress-${i}`,modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
        bindings:{MAP_ORIGIN:origin,MAP_AUTH_GENERATION:g},durableObjects:{MAP_AUTHORITY:{className:'OwnerAuthority',scriptName:'authority',useSQLite:true}},
        outboundService:()=>{throw Error('No external network allowed');}})),
    ]});await mf.ready;
    return Promise.all(workerGenerations.map((_,i)=>mf.getWorker(`ingress-${i}`)));
  }
  return {start,async close(){if(mf)await mf.dispose();await rm(directory,{recursive:true,force:true});}};
}
const login=(worker,password='synthetic-runtime-password')=>worker.fetch(origin+'/auth/login',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password}).toString()});
const status=(worker,cookie)=>worker.fetch(origin+'/api/status',{headers:{cookie}});
async function loginCookie(worker,password) { const r=await login(worker,password);assert.equal(r.status,303,await r.text());return r.headers.get('set-cookie').split(';')[0]; }
test('actual workerd: two ingress Workers share durable revocation across process restarts and generation rotation',async()=>{
  const h=await setup();try{
    let [a,b]=await h.start();const c=await loginCookie(a);
    assert.equal((await status(b,c)).status,200);
    [a,b]=await h.start();assert.equal((await status(a,c)).status,200);
    assert.equal((await b.fetch(origin+'/auth/logout',{method:'POST',redirect:'manual',headers:{origin,cookie:c}})).status,303);
    [a,b]=await h.start();assert.equal((await status(a,c)).status,401);
    const prior=await loginCookie(a);
    [a,b]=await h.start('2',['1','2'],'synthetic-rotated-password');
    assert.equal((await status(b,prior)).status,401);assert.equal((await status(a,prior)).status,503);
    const fresh=await loginCookie(b,'synthetic-rotated-password');
    [a,b]=await h.start('1');assert.equal((await status(a,prior)).status,503);
    [a,b]=await h.start('2',['2','2'],'synthetic-rotated-password');assert.equal((await status(a,fresh)).status,200);
  }finally{await h.close();}
});
test('actual workerd: simultaneous failed logins across ingress Workers cannot exceed five-attempt budget or reset on restart',async()=>{
  const h=await setup();try{
    const workers=await h.start();const responses=await Promise.all(Array.from({length:12},(_,i)=>login(workers[i%2],'wrong')));
    assert.equal(responses.filter(r=>r.status===401).length,5,JSON.stringify(await Promise.all(responses.map(async r=>({status:r.status,body:await r.text()})))));assert.equal(responses.filter(r=>r.status===429).length,7);
    const [a]=await h.start();assert.equal((await login(a)).status,429);
  }finally{await h.close();}
});
