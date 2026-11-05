import { digest, equal, hex, passwordHash } from './crypto.mjs';
const lifetime = 3600000;
function validRecord(record) {
  return record.schema === 1 && Number.isSafeInteger(record.generation) && record.generation > 0 && /^[a-f0-9]{64}$/.test(record.fingerprint || '')
    && Number.isSafeInteger(record.attempts?.count) && record.attempts.count >= 0 && record.attempts.count <= 5 && Number.isFinite(record.attempts.until) && record.attempts.until >= 0
    && Array.isArray(record.sessions) && record.sessions.length <= 16 && record.sessions.every(s=>s && /^[a-f0-9]{64}$/.test(s.key || '') && Number.isFinite(s.expires) && s.expires > 0);
}
const reply = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
// One named Durable Object per owner namespace. This class is only provisioned
// by local Miniflare in this task; no hosted namespace or migration is applied.
export class OwnerAuthority {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch(request) {
    try {
      // Password verification awaits WebCrypto, so serialize the whole operation,
      // not just storage calls. Exactly one state record is atomically committed.
      return await this.state.blockConcurrencyWhile(async () => {
        const generation = Number(this.env.MAP_AUTH_GENERATION);
        if (!Number.isSafeInteger(generation) || generation < 1 || !/^[a-f0-9]{64}$/.test(this.env.MAP_OWNER_PASSWORD_HASH || '') || (this.env.MAP_OWNER_SALT || '').length < 16) return reply({error:'Auth configuration unavailable'},503);
        if (request.method !== 'POST' || new URL(request.url).origin !== 'https://map-auth.internal') return reply({error:'Invalid authority request'},400);
        const body = await request.json();
        if (body.generation !== generation) return reply({error:'Auth generation mismatch'},503);
        const fingerprint = await digest(this.env.MAP_OWNER_SALT + ':' + this.env.MAP_OWNER_PASSWORD_HASH);
        let record = await this.state.storage.get('owner');
        if (record && !validRecord(record)) return reply({error:'Auth state unavailable'},503);
        if (record && (generation < record.generation || (generation === record.generation && fingerprint !== record.fingerprint))) return reply({error:'Auth generation conflict'},503);
        if (!record || generation > record.generation) {
          record = { schema:1, generation, fingerprint, attempts:{count:0,until:0}, sessions:[] };
          // Persist the monotonic generation before accepting any requests.
          await this.state.storage.put('owner', record);
        }
        const now = Date.now();
        record.sessions = record.sessions.filter(s => Number.isFinite(s.expires) && s.expires > now);
        const action = new URL(request.url).pathname;
        if (action === '/login') {
          if (record.attempts.until > now && record.attempts.count >= 5) return reply({error:'잠시 뒤 다시 시도해 주세요.'},429);
          // Reserve every permitted attempt atomically before expensive work.
          record.attempts = {count:(record.attempts.until > now ? record.attempts.count : 0)+1,until:record.attempts.until > now ? record.attempts.until : now+300000};
          await this.state.storage.put('owner', record);
          const password = body.password;
          if (typeof password !== 'string' || !password || password.length > 256 || !equal(await passwordHash(password,this.env.MAP_OWNER_SALT),this.env.MAP_OWNER_PASSWORD_HASH)) return reply({error:'로그인 실패. 뒤로 가서 다시 시도해 주세요.'},401);
          const token = hex(crypto.getRandomValues(new Uint8Array(32)));
          // A bounded owner session set avoids unbounded persistent state.
          record.sessions = [...record.sessions.slice(-15), {key:await digest(token),expires:now+lifetime}];
          record.attempts = {count:0,until:0};
          await this.state.storage.put('owner',record);
          return reply({token});
        }
        if (!['/verify','/logout'].includes(action)) return reply({error:'Unknown authority operation'},404);
        const key = typeof body.token === 'string' && /^[a-f0-9]{64}$/.test(body.token) ? await digest(body.token) : null;
        if (action === '/logout') {
          record.sessions = record.sessions.filter(s=>s.key!==key);
          await this.state.storage.put('owner',record);
          return reply({revoked:true});
        }
        return reply({authenticated:key!==null && record.sessions.some(s=>s.key===key)});
      });
    } catch { return reply({error:'Auth authority unavailable'},503); }
  }
}
