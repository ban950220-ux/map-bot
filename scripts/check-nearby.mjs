import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse } from "miniflare";
import { readMapsCredentials } from "./maps-test-credentials.mjs";
const live = process.argv.includes("--live");
const bindings = live ? readMapsCredentials() : { NAVER_MAPS_CLIENT_ID: "fixture-id", NAVER_MAPS_CLIENT_SECRET: "fixture-secret", KAKAO_REST_API_KEY: "fixture-kakao" };
const bundle = async contents => (await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: "nearby-check.ts", loader: "ts" }, bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers"] })).outputFiles[0].text;
const helpers = await import("data:text/javascript;base64," + Buffer.from(await bundle(`export * from "./services/maps/ranking"; export * from "./services/maps/cache"; export * from "./services/maps/schema"; export * from "./lib/nearby-client";`)).toString("base64"));
const script = await bundle(`
 import { geocode, driving } from "./lib/naver";
 import { searchNearby } from "./services/maps/placeSearch";
 import { calculateRouteMatrix } from "./services/maps/routeMatrix";
 export default { async fetch(request) {
   const input = await request.json();
   try {
     if(input.action === "geocode") return Response.json(await geocode(input.address));
     if(input.action === "search") return Response.json(await searchNearby(input.query,input.origin,input.radius,input.count,input.expand));
     if(input.action === "routes") return Response.json(await calculateRouteMatrix(input.origin,input.candidates));
     if(input.action === "legacy") return Response.json(await driving(input.origin,input.destination,{id:0,name:"legacy",brand:"test",address:input.destination.address}));
     return Response.json({error:"unknown action"},{status:400});
   } catch(error) { return Response.json({error:error.message},{status:error.status || 500}); }
 } };
`);
const originFixture = { x: 127.4, y: 37.27, address: "fixture location" };
const docs = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1), place_name: `테스트 매장 ${i + 1}`, x: String(127.4 + (i + 1) * .001), y: String(37.27 + (i + 1) * .001), address_name: "테스트 주소", road_address_name: "테스트 도로", category_name: "음식점", phone: "", place_url: `http://place.map.kakao.com/${i + 1}` }));
let active = 0, peak = 0, callCount = 0, failureId = 0, quota = false;
const worker = new Miniflare({ modules: true, script, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], bindings, cf: false,
  ...(live ? {} : { outboundService: async request => {
    callCount++;
    const url = new URL(request.url);
    if(url.hostname === "dapi.kakao.com") {
      assert.equal(request.headers.get("authorization"), "KakaoAK fixture-kakao");
      assert.equal(url.searchParams.get("sort"), "distance");
      const radius = Number(url.searchParams.get("radius"));
      const matches = url.searchParams.get("query") === "no-results" ? [] : docs.filter(p => helpers.haversine(originFixture,{latitude:Number(p.y),longitude:Number(p.x)}) <= radius);
      const page = Number(url.searchParams.get("page")), start = (page - 1) * 15;
      return WorkerResponse.json({meta:{is_end:start+15>=matches.length,total_count:matches.length,pageable_count:matches.length},documents:matches.slice(start,start+15)});
    }
    assert.equal(url.origin,"https://maps.apigw.ntruss.com");
    assert.equal(request.headers.get("x-ncp-apigw-api-key"),"fixture-secret");
    if(url.pathname.includes("geocode")) return WorkerResponse.json({addresses:[{x:String(originFixture.x),y:String(originFixture.y),roadAddress:originFixture.address}]});
    active++; peak=Math.max(peak,active); await new Promise(resolve=>setTimeout(resolve,20)); active--;
    const id=Math.round((Number(url.searchParams.get("goal").split(",")[0])-127.4)*1000);
    if(quota) return WorkerResponse.json({error:"fixture quota"},{status:429});
    if(id===failureId) return WorkerResponse.json({error:"fixture failure"},{status:500});
    const option=url.searchParams.get("option");
    assert.ok(["traoptimal","trafast"].includes(option));
    return WorkerResponse.json({code:0,route:{[option]:[{summary:{duration:(40-id)*60000,distance:(id+1)*600,tollFare:0},path:[[127.4,37.27],[Number(docs[id-1]?.x||127.41),Number(docs[id-1]?.y||37.28)]]}]}});
  } }) });
async function invoke(input) {
  const response=await worker.dispatchFetch("http://test.local/",{method:"POST",body:JSON.stringify(input)});
  const data=await response.json();
  assert.equal(response.status,200,data.error||"Worker request failed"); return data;
}
try {
  const origin=live ? await invoke({action:"geocode",address:"경기도 이천시 대산로247번길 50"}) : originFixture;
  async function scenario(query,radius,expand,sort,count=5) {
    const search=await invoke({action:"search",origin,query,radius,count,expand});
    assert.ok(search.candidates.length<=30);
    search.candidates.forEach(p=>assert.ok(p.straightDistance<=search.searchedRadius));
    const candidates=[];
    for(let offset=0;offset<search.candidates.length;offset+=4) candidates.push(...await invoke({action:"routes",origin,candidates:search.candidates.slice(offset,offset+4)}));
    const ranked=helpers.rankCandidates(candidates,sort);
    for(let i=1;i<ranked.length;i++) assert.ok(sort==="distance" ? ranked[i-1].drivingDistance<=ranked[i].drivingDistance : helpers.eta(ranked[i-1])<=helpers.eta(ranked[i]));
    const summary={query,requestedRadius:radius,searchedRadius:search.searchedRadius,candidates:candidates.length,success:ranked.length,top:ranked.slice(0,count).map(p=>({name:p.name,minutes:Math.ceil(helpers.eta(p)/60000),km:Number((p.drivingDistance/1000).toFixed(2)),traffic:p.route.trafficAware,checkedAt:p.route.checkedAt}))};
    console.log(JSON.stringify({test:sort==="distance"?"2-road-distance":"1-time",live,...summary}));
    return {search,candidates,ranked};
  }
  const time=await scenario("양꼬치",5000,true,"time");
  assert.ok(time.ranked.length>0,"No drivable restaurants found");
  const distance=await scenario("스타벅스",5000,true,"distance");
  assert.ok(distance.ranked.length>0,"No drivable Starbucks found");
  const small=await invoke({action:"search",origin,query:"양꼬치",radius:1000,count:15,expand:false});
  const expanded=await invoke({action:"search",origin,query:"양꼬치",radius:1000,count:15,expand:true});
  assert.equal(small.searchedRadius,1000); assert.ok(expanded.searchedRadius>=1000);
  if(small.candidates.length<15) assert.ok(expanded.searchedRadius>1000);
  console.log(JSON.stringify({test:"3-small-radius",live,within1km:small.candidates.length,expandedRadius:expanded.searchedRadius,expandedCandidates:expanded.candidates.length}));
  const legacy=await invoke({action:"legacy",origin,destination:{x:time.ranked[0].longitude,y:time.ranked[0].latitude,address:time.ranked[0].address}});
  assert.ok(legacy.durationMs>=0&&legacy.distanceM>=0); console.log("PASS: existing direct-route API adapter");
  if(!live) {
    assert.notEqual(time.ranked[0].id,distance.ranked[0].id,"Time and road-distance order must be independent");
    // A different origin avoids previous successful cache entries for fault injection.
    failureId=3;
    const batch=await invoke({action:"routes",origin:{...origin,x:origin.x+.00001},candidates:time.search.candidates.slice(0,5)});
    assert.equal(batch.filter(p=>p.routeError).length,1); assert.equal(helpers.rankCandidates(batch,"time").length,4);
    assert.ok(peak<=4); console.log("PASS: test 4 single failure preserves four routes; concurrency <=4");
    quota=true;
    const limited=await invoke({action:"routes",origin:{...origin,x:origin.x+.00002},candidates:time.search.candidates.slice(0,7)});
    assert.ok(limited.some(p=>p.routeErrorFatal)); assert.equal(limited.filter(p=>!p.routeError).length,0); quota=false;
    const before=callCount; const cached=await invoke({action:"search",origin,query:"양꼬치",radius:5000,count:5,expand:true});
    assert.equal(cached.cached,true); assert.equal(callCount,before);
    const empty=await invoke({action:"search",origin,query:"no-results",radius:1000,count:5,expand:true}); assert.equal(empty.candidates.length,0);
    const duplicate=[time.search.candidates[0],{...time.search.candidates[0],id:"kakao:999"},...time.search.candidates];
    assert.equal(helpers.filterCandidates(duplicate,origin,5000,30).length,time.search.candidates.length);
    assert.equal(helpers.routesSchema.safeParse({origin,candidates:time.search.candidates.slice(0,5)}).success,false);
    let now=0; const ttl=new helpers.TtlCache(45,2,()=>now); ttl.set("a",{value:1}); now=46; assert.equal(ttl.get("a"),undefined);
    const controller=new AbortController(); let posted=0,last;
    await assert.rejects(()=>helpers.runNearbyComparison({address:"현재 위치",location:{...origin,accuracy:7},query:"양꼬치",radius:5000,count:5,expand:true},controller.signal,p=>{last=p;if(p.done===4)controller.abort();},async(path,body)=>{
      posted++; assert.deepEqual(Object.keys(body.origin).sort(),["address","x","y"]);
      if(path==="/api/places")return time.search;
      return {candidates:body.candidates.map(p=>({...p,drivingDistance:10,drivingDuration:20}))};
    })); assert.equal(posted,2); assert.equal(last.snapshot.completed,false); assert.equal(last.snapshot.candidates.length,4);
    const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,"navigator");
    Object.defineProperty(globalThis,"navigator",{configurable:true,value:{geolocation:{getCurrentPosition:(_success,fail)=>fail({code:1})}}});
    await assert.rejects(helpers.currentLocation,/권한이 거부/);
    if(navigatorDescriptor)Object.defineProperty(globalThis,"navigator",navigatorDescriptor);else delete globalThis.navigator;
    console.log("PASS: quota, cache TTL, empty results, deduplication, request validation, GPS coordinate payload, location denial and cancellation");
  }
  console.log(JSON.stringify({result:"PASS",mode:live?"live NAVER + Kakao in workerd":"mock upstream in workerd",gps:"test coordinates, not device GPS"}));
} finally { await worker.dispose(); }
