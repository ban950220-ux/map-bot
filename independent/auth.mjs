// Independent owner boundary. Never mounted by the Sites build.
export { passwordHash } from './crypto.mjs';
const cookieName = '__Host-map-session';
const lifetime = 60 * 60;
const publicPaths = new Set(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/favicon.svg', '/sw.js']);
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };
async function authority(env, action, payload) {
  try {
    const generation = Number(env.MAP_AUTH_GENERATION);
    if (!Number.isSafeInteger(generation) || generation < 1 || !env.MAP_AUTHORITY) return {status:503,data:{error:'Independent auth is not configured'}};
    const stub=env.MAP_AUTHORITY.get(env.MAP_AUTHORITY.idFromName('map-owner-v1'));
    const r=await stub.fetch('https://map-auth.internal/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,generation})});
    if (![200,401,429].includes(r.status)) return {status:503,data:{error:'Auth authority unavailable'}};
    return {status:r.status,data:await r.json()};
  } catch { return {status:503,data:{error:'Auth authority unavailable'}}; }
}
function authFailure(result) { return response(result.data.error || 'Auth authority unavailable',result.status,result.status===429?{'Retry-After':'300'}:{}); }
async function readLimitedForm(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 2048) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function response(body, status = 200, headers = {}) { return new Response(body, { status, headers: { ...noStore, ...headers } }); }
function redirect(location, headers = {}) { return response(null, 303, { Location: location, ...headers }); }
function cookie(value, maxAge) { return `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`; }
const loginHtml = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon-192.png"><title>MAP 소유자 로그인</title><style>body{font:18px system-ui;max-width:28rem;margin:10vh auto;padding:24px;background:#f3f6fa;color:#162b46}input,button{box-sizing:border-box;display:block;width:100%;min-height:48px;margin:12px 0;font:inherit}a{display:inline-block;padding:12px}</style><h1>가까운 한 끼</h1><p>소유자 전용 독립 앱입니다.</p><form action="/auth/login" method="post"><label for="password">소유자 비밀번호</label><input id="password" name="password" type="password" required maxlength="256" autocomplete="current-password"><button>로그인</button></form><p>연결이 필요합니다. 검색 결과와 위치정보는 오프라인에 저장하지 않습니다.</p></html>`;
export function createIndependentWorker(app) {
  return { async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let origin;
    try { origin = new URL(env.MAP_ORIGIN); } catch { return response('Independent auth is not configured', 503); }
    const loopback = ['127.0.0.1', 'localhost'].includes(origin.hostname);
    if (origin.origin !== env.MAP_ORIGIN || origin.origin !== url.origin || (origin.protocol !== 'https:' && !loopback)) return response('Invalid origin', 403);
    if ([...request.headers.keys()].some(name => name.startsWith('oai-') || name.startsWith('x-map-'))) return response('Untrusted identity header', 400);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return response('Cross-site request denied', 403);
    const mutation = !['GET', 'HEAD'].includes(request.method);
    if (mutation && request.headers.get('origin') !== origin.origin) return response('Origin required', 403);
    if (publicPaths.has(url.pathname) || (/^\/_next\/static\/[a-zA-Z0-9_./-]+\.(js|css|woff2?)$/.test(url.pathname))) {
      if (!['GET', 'HEAD'].includes(request.method)) return response('Method not allowed', 405);
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers); Object.entries(noStore).forEach(([k,v]) => headers.set(k,v));
      if (url.pathname === '/sw.js') { headers.set('Content-Type', 'text/javascript'); headers.set('Service-Worker-Allowed', '/'); }
      if (url.pathname === '/manifest.webmanifest') headers.set('Content-Type', 'application/manifest+json');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (!env.MAP_AUTHORITY || !Number.isSafeInteger(Number(env.MAP_AUTH_GENERATION)) || Number(env.MAP_AUTH_GENERATION) < 1) return response('Independent auth is not configured', 503);
    if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/signout-with-chatgpt') return redirect('/auth/login');
    if (url.pathname === '/auth/login') {
      if (request.method === 'GET') return response(loginHtml, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; manifest-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
      if (request.method !== 'POST') return response('Method not allowed', 405);
      if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return response('Invalid form', 415);
      const text = await readLimitedForm(request); if (text === null) return response('Form too large', 413);
      const password = new URLSearchParams(text).get('password') || '';
      if (!password || password.length > 256) return response('로그인 실패. 뒤로 가서 다시 시도해 주세요.',401);
      const login=await authority(env,'login',{password});
      if(login.status!==200) return authFailure(login);
      const token=login.data.token;
      if(typeof token!=='string' || !/^[a-f0-9]{64}$/.test(token)) return response('Auth authority unavailable',503);
      return redirect('/', { 'Set-Cookie': cookie(token, lifetime) });
    }
    const matches = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(cookieName + '='));
    const token = matches.length === 1 ? matches[0].slice(cookieName.length + 1) : '';
    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') return response('Method not allowed', 405);
      const logout=await authority(env,'logout',{token});
      // Never claim logout succeeded if the durable revocation did not commit.
      if(logout.status!==200 || logout.data.revoked!==true) return response('로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.',503);
      return redirect('/auth/login', { 'Set-Cookie': cookie('', 0), 'Clear-Site-Data': '"cache", "storage"' });
    }
    const verified=await authority(env,'verify',{token});
    if(verified.status!==200) return authFailure(verified);
    if(verified.data.authenticated!==true) return url.pathname.startsWith('/api/') ? response(JSON.stringify({ error: '소유자 로그인이 필요합니다.' }), 401, { 'Content-Type': 'application/json' }) : redirect('/auth/login');
    const headers = new Headers(request.headers);
    headers.delete('cookie'); headers.set('x-map-owner', 'verified-owner');
    const upstream = await app.fetch(new Request(request, { headers }), env, ctx);
    const resultHeaders = new Headers(upstream.headers);
    Object.entries(noStore).forEach(([k,v]) => resultHeaders.set(k,v));
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: resultHeaders });
  } };
}
