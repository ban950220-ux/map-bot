import assert from "node:assert/strict";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse } from "miniflare";
import { readMapsCredentials } from "./maps-test-credentials.mjs";
const live = process.argv.includes("--live");
const bindings = live ? readMapsCredentials() : { NAVER_MAPS_CLIENT_ID: "fixture-id", NAVER_MAPS_CLIENT_SECRET: "fixture-secret", KAKAO_REST_API_KEY: "fixture-kakao" };
const bundle = async contents => (await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: "nearby-check.ts", loader: "ts" }, bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers"] })).outputFiles[0].text;
const helpers = await import("data:text/javascript;base64," + Buffer.from(await bundle(`export * from "./services/maps/ranking"; export * from "./services/maps/cache"; export * from "./services/maps/schema"; export * from "./services/maps/searchIntent"; export * from "./lib/nearby-client";`)).toString("base64"));
const script = await bundle(`
 import { driving } from "./lib/naver";
 import { geocodeAddress } from "./services/maps/geocoding";
 import { searchNearby } from "./services/maps/placeSearch";
 import { calculateRouteMatrix } from "./services/maps/routeMatrix";
 export default { async fetch(request) {
   const input = await request.json();
   try {
     if(input.action === "geocode") return Response.json(await geocodeAddress(input.address));
     if(input.action === "search") return Response.json(await searchNearby(input.query,input.origin,input.radius,input.count,input.expand));
     if(input.action === "routes") return Response.json(await calculateRouteMatrix(input.origin,input.candidates));
     if(input.action === "legacy") return Response.json(await driving(input.origin,input.destination,{id:0,name:"legacy",brand:"test",address:input.destination.address}));
     return Response.json({error:"unknown action"},{status:400});
   } catch(error) { return Response.json({error:error.message},{status:error.status || 500}); }
 } };
`);
const originFixture = { x: 127.4, y: 37.27, address: "fixture location" };
const docs = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1), place_name: `테스트 매장 ${i + 1}`, x: String(127.4 + (i + 1) * .001), y: String(37.27 + (i + 1) * .001), address_name: "테스트 주소", road_address_name: "테스트 도로", category_name: "음식점", phone: "", place_url: `http://place.map.kakao.com/${i + 1}` }));
const parkingDocs = [{ id: "8001", place_name: "테스트 공영주차장", x: "127.4011", y: "37.2711", address_name: "주차장 주소", road_address_name: "주차장 도로", category_name: "교통,수송 > 주차장", phone: "", place_url: "http://place.map.kakao.com/8001" }];
let active = 0, peak = 0, callCount = 0, failureId = 0, quota = false;
const worker = new Miniflare({ modules: true, script, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"], bindings, cf: false,
  ...(live ? {} : { outboundService: async request => {
    callCount++;
    const url = new URL(request.url);
    if(url.hostname === "dapi.kakao.com") {
      assert.equal(request.headers.get("authorization"), "KakaoAK fixture-kakao");
      if (!url.searchParams.has("x")) {
        assert.equal(url.searchParams.get("sort"), "accuracy");
        const originDocs=url.searchParams.get("query")==="롯데마트" ? [{...docs[0],place_name:"롯데마트 이천점"},{...docs[1],place_name:"롯데마트 경기광주점"}] : [{...docs[0],place_name:"SK하이닉스 이천캠퍼스",road_address_name:"경기도 이천시 부발읍 경충대로 2091"}];
        return WorkerResponse.json({meta:{is_end:true,total_count:originDocs.length,pageable_count:originDocs.length},documents:originDocs});
      }
      assert.ok(["accuracy","distance"].includes(url.searchParams.get("sort")));
      const radius = url.searchParams.has("rect") ? 200000 : Number(url.searchParams.get("radius"));
      if (radius > 20000) { assert.equal(url.searchParams.has("radius"), false); assert.equal(url.searchParams.get("rect").split(",").length, 4); }
      const sourceDocs=url.searchParams.get("category_group_code")==="PK6" ? parkingDocs : docs;
      const matches = url.searchParams.get("query") === "no-results" ? [] : sourceDocs.filter(p => helpers.haversine(originFixture,{latitude:Number(p.y),longitude:Number(p.x)}) <= radius);
      const page = Number(url.searchParams.get("page")), start = (page - 1) * 15;
      return WorkerResponse.json({meta:{is_end:start+15>=matches.length,total_count:matches.length,pageable_count:matches.length},documents:matches.slice(start,start+15)});
    }
    assert.equal(url.origin,"https://maps.apigw.ntruss.com");
    assert.equal(request.headers.get("x-ncp-apigw-api-key"),"fixture-secret");
    if(url.pathname.includes("geocode")) return WorkerResponse.json({addresses:["이천 SK하이닉스","롯데마트"].includes(url.searchParams.get("query"))?[]:[{x:String(originFixture.x),y:String(originFixture.y),roadAddress:originFixture.address}]});
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
  if(!live) {
    const placeOrigin=await invoke({action:"geocode",address:"이천 SK하이닉스"});
    assert.match(placeOrigin.address,/SK하이닉스/);
    const ambiguousOrigin=await invoke({action:"geocode",address:"롯데마트"});
    assert.equal(ambiguousOrigin.needsSelection,true); assert.equal(ambiguousOrigin.candidates.length,2); assert.match(ambiguousOrigin.candidates[0].name,/이천점/);
    await assert.rejects(()=>helpers.runNearbyComparison({address:"롯데마트",query:"카페",radius:5000,count:5,expand:false},new AbortController().signal,()=>{},async(path)=>{
      assert.equal(path,"/api/geocode"); return ambiguousOrigin;
    }),error=>error instanceof helpers.OriginSelectionRequiredError&&error.candidates.length===2);
    assert.deepEqual(helpers.parseSearchIntent("주차 가능한 카페"),{rawQuery:"주차 가능한 카페",poiQuery:"카페",parkingPreference:"required"});
    assert.deepEqual(helpers.parseSearchIntent("카페"),{rawQuery:"카페",poiQuery:"카페",parkingPreference:"none"});
  }
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
  assert.ok(time.search.candidates.every(p=>p.source==="kakao-local"&&p.storeParking.status==="unknown"&&p.storeParking.source==="unknown"));
  const parkingIntent=await invoke({action:"search",origin,query:"주차 가능한 카페",radius:5000,count:5,expand:false});
  assert.equal(parkingIntent.intent.poiQuery,"카페"); assert.equal(parkingIntent.intent.parkingPreference,"required");
  assert.ok(parkingIntent.candidates.every(p=>!/주차장$/.test(p.name)));
  assert.ok(parkingIntent.candidates.every(p=>p.storeParking.status==="unknown"));
  assert.equal(parkingIntent.candidates[0].nearbyParking.status,"found"); assert.match(parkingIntent.candidates[0].nearbyParking.name,/주차장/);
  assert.equal(parkingIntent.candidates[0].storeParking.status,"unknown","Nearby parking must not become store parking");
  const parkingRouted=await invoke({action:"routes",origin,candidates:parkingIntent.candidates.slice(0,1)});
  assert.equal(parkingRouted[0].nearbyParking.status,"found"); assert.equal(parkingRouted[0].storeParking.status,"unknown");
  const parkingLots=await invoke({action:"search",origin,query:"주차장",radius:5000,count:5,expand:false});
  assert.ok(parkingLots.candidates.some(p=>/주차장$/.test(p.name)),"PK6 parking lot search must not be filtered out");
  for (const query of ["카페","주유소","대형마트"]) { const quality=await invoke({action:"search",origin,query,radius:5000,count:5,expand:false}); assert.ok(quality.candidates.length>0,`${query} candidates missing`); }
  const distance=await scenario("스타벅스",5000,true,"distance");
  assert.ok(distance.ranked.length>0,"No drivable Starbucks found");
  const small=await invoke({action:"search",origin,query:"양꼬치",radius:1000,count:15,expand:false});
  const expanded=await invoke({action:"search",origin,query:"양꼬치",radius:1000,count:15,expand:true});
  assert.equal(small.searchedRadius,1000); assert.ok(expanded.searchedRadius>=1000);
  if(small.candidates.length<15) assert.ok(expanded.searchedRadius>1000);
  console.log(JSON.stringify({test:"3-small-radius",live,within1km:small.candidates.length,expandedRadius:expanded.searchedRadius,expandedCandidates:expanded.candidates.length}));
  const wide=await invoke({action:"search",origin,query:"카페",radius:200000,count:5,expand:false});
  assert.equal(wide.searchedRadius,200000); assert.ok(wide.candidates.length>0);
  assert.ok(wide.candidates.every(p=>p.straightDistance<=200000));
  assert.equal(helpers.nearbySchema.safeParse({origin,query:"카페",radius:200000,count:5,expand:false}).success,true);
  assert.equal(helpers.nearbySchema.safeParse({origin,query:"카페",radius:200001,count:5,expand:false}).success,false);
  assert.equal(helpers.candidateSchema.safeParse({...wide.candidates[0],straightDistance:199999}).success,true);
  console.log(JSON.stringify({test:"200km category search and radius validation",live,candidates:wide.candidates.length}));
  const legacy=await invoke({action:"legacy",origin,destination:{x:time.ranked[0].longitude,y:time.ranked[0].latitude,address:time.ranked[0].address}});
  assert.ok(legacy.durationMs>=0&&legacy.distanceM>=0); console.log("PASS: existing direct-route API adapter");
  if(!live) {
    assert.notEqual(time.ranked[0].id,distance.ranked[0].id,"Time and road-distance order must be independent");
    const sortFixture=[
      {...time.ranked[0],id:"kakao:901",trafficDuration:60000,drivingDuration:60000,drivingDistance:3000,relevanceRank:2},
      {...time.ranked[0],id:"kakao:902",trafficDuration:180000,drivingDuration:180000,drivingDistance:1000,relevanceRank:0},
      {...time.ranked[0],id:"kakao:903",trafficDuration:120000,drivingDuration:120000,drivingDistance:2000,relevanceRank:1},
    ];
    assert.equal(helpers.rankCandidates(sortFixture,"time")[0].id,"kakao:901");
    assert.equal(helpers.rankCandidates(sortFixture,"distance")[0].id,"kakao:902");
    assert.equal(helpers.rankCandidates(sortFixture,"relevance")[0].id,"kakao:902");
    assert.equal(helpers.rankCandidates(sortFixture,"recommended")[0].id,"kakao:901");
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
    let resumedPosts=0;
    const resumed=await helpers.runNearbyComparison({address:"현재 위치",location:{...origin,accuracy:7},query:"양꼬치",radius:5000,count:5,expand:true},new AbortController().signal,()=>{},async(path,body)=>{
      resumedPosts++; assert.equal(path,"/api/nearby-routes");
      return {candidates:body.candidates.map(p=>({...p,drivingDistance:10,drivingDuration:20}))};
    },last.snapshot);
    assert.equal(resumedPosts,Math.ceil((time.search.candidates.length-last.snapshot.candidates.length)/4)); assert.equal(resumed.candidates.length,time.search.candidates.length); assert.equal(resumed.completed,true);
    const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,"navigator");
    Object.defineProperty(globalThis,"navigator",{configurable:true,value:{geolocation:{getCurrentPosition:(_success,fail)=>fail({code:1})}}});
    await assert.rejects(helpers.currentLocation,/권한이 거부/);
    if(navigatorDescriptor)Object.defineProperty(globalThis,"navigator",navigatorDescriptor);else delete globalThis.navigator;
    console.log("PASS: quota, cache TTL, empty results, deduplication, request validation, GPS coordinate payload, location denial, cancellation and resume");
  }
  console.log(JSON.stringify({result:"PASS",mode:live?"live NAVER + Kakao in workerd":"mock upstream in workerd",gps:"test coordinates, not device GPS"}));
} finally { await worker.dispose(); }
