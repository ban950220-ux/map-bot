import '../../scripts/sites-env.mjs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare } from 'miniflare';
import { createUpstream } from '../browser/upstream.mjs';
import { installMapSdk } from '../browser/map-sdk.mjs';
import { passwordHash } from '../../independent/auth.mjs';
export const syntheticPassword = 'synthetic-independent-owner-only';
export async function createIndependentHarness({ preview = false } = {}) {
  const upstream = createUpstream(); const errors=[];
  let worker;
  const server = createServer(async (req,res) => {
    const controller=new AbortController(); res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    try {
      if(req.headers.host !== new URL(url).host) {res.writeHead(403).end();return;}
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const body=Buffer.concat(chunks);
      const r=await worker.dispatchFetch(url+req.url,{redirect:'manual',method:req.method,headers:req.headers,...(body.length?{body}:{}),signal:controller.signal});
      const headers=Object.fromEntries(r.headers);delete headers['content-length'];delete headers['content-encoding'];
      let data=Buffer.from(await r.arrayBuffer());
      if(preview){
        headers['content-security-policy']="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; form-action 'self'; object-src 'none'";
        if(headers['content-type']?.includes('text/html')) data=Buffer.from(data.toString().replace('</head>',`<script>(${installMapSdk.toString()})()</script></head>`));
      }
      if(!res.destroyed){res.writeHead(r.status,headers);res.end(data);}
    } catch(e) {if(!controller.signal.aborted){errors.push(e.message);res.writeHead(500).end('Local candidate failed');}}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const root=path.resolve('dist-independent/server');
  const files=(await readdir(root,{recursive:true})).filter(f=>/\.(?:m?js)$/.test(f)&&f!=='index.js');
  worker=new Miniflare({modules:['index.js',...files].map(f=>({type:'ESModule',path:path.join(root,f)})),modulesRoot:root,
    compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,
    durableObjects:{MAP_AUTHORITY:{className:'OwnerAuthority',useSQLite:true}},
    bindings:{MAP_AUTH_GENERATION:'1',MAP_ORIGIN:url,MAP_OWNER_SALT:'synthetic-independent-salt',MAP_OWNER_PASSWORD_HASH:await passwordHash(syntheticPassword,'synthetic-independent-salt'),NAVER_MAPS_CLIENT_ID:'fixture-id',NAVER_MAPS_CLIENT_SECRET:'fixture-secret',KAKAO_REST_API_KEY:'fixture-kakao'},
    outboundService:upstream.fetch,
    serviceBindings:{ASSETS:async request=>{
      const name=new URL(request.url).pathname;const target=path.resolve('dist-independent/client','.'+decodeURIComponent(name));
      if(!target.startsWith(path.resolve('dist-independent/client')+path.sep))return new Response(null,{status:404});
      try {const data=await readFile(target);return new Response(data,{headers:{'Content-Type':{'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[path.extname(target)]||'application/octet-stream'}});}catch{return new Response(null,{status:404});}
    }},
  });await worker.ready;
  return {url,worker,errors,...upstream,async close(){upstream.state.holdRoutes?.gate.release();upstream.state.holdPlaces?.gate.release();server.closeAllConnections();await new Promise(r=>server.close(r));await worker.dispose();}};
}
