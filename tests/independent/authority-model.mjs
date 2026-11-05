import { OwnerAuthority } from '../../independent/authority.mjs';
// Model a single named strongly consistent authority shared by multiple ingress
// Workers. Persistent records are cloned, and operation order survives restart.
export function authorityModel(env) {
  const store=new Map(); let queue=Promise.resolve(); let fail=false;
  const state={storage:{async get(k){if(fail)throw Error('synthetic storage unavailable');return structuredClone(store.get(k));},async put(k,v){if(fail)throw Error('synthetic storage unavailable');store.set(k,structuredClone(v));}},blockConcurrencyWhile(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}};
  let instance=new OwnerAuthority(state,env);
  return {store,state,env,
    namespace:{idFromName(name){if(name!=='map-owner-v1')throw Error('wrong authority');return name;},get(){return {fetch:(url,init)=>instance.fetch(new Request(url,init))};}},
    restart(nextEnv=env){instance=new OwnerAuthority(state,nextEnv);},
    failStorage(value){fail=value;},
  };
}
