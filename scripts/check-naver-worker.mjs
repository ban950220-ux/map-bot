import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { Miniflare, Response as WorkerResponse } from "miniflare";

// Run the real API client inside workerd, not Node's different fetch runtime.
// --live reads existing Windows credentials into memory only; never prints them.
const live = process.argv.includes("--live");
const bindings = live
  ? JSON.parse(execFileSync("C:/Users/ban357/AppData/Local/Python/pythoncore-3.14-64/python.exe", ["-c", "import json,keyring; print(json.dumps({'NAVER_MAPS_CLIENT_ID':keyring.get_password('naver_maps','client_id'),'NAVER_MAPS_CLIENT_SECRET':keyring.get_password('naver_maps','client_secret')}))"], { encoding: "utf8" }))
  : { NAVER_MAPS_CLIENT_ID: "test-client", NAVER_MAPS_CLIENT_SECRET: "test-secret" };
assert.ok(bindings.NAVER_MAPS_CLIENT_ID && bindings.NAVER_MAPS_CLIENT_SECRET, "Credentials are missing");
const { outputFiles } = await build({
  stdin: { contents: `
    import { geocode, driving } from "./lib/naver.ts";
    export default { async fetch(request) {
      if (new URL(request.url).pathname === "/probe-redirect") {
        try { new Request("https://maps.apigw.ntruss.com/", { redirect: "error" }); }
        catch (error) { return Response.json({ error: error.message }); }
      }
      try {
        const origin = await geocode("경기도 이천시 대산로247번길 50");
        if (new URL(request.url).pathname === "/geocode") return Response.json(origin);
        const destination = await geocode("경기도 수원시 영통구 청명남로 25");
        return Response.json(await driving(origin, destination, { id: 0, name: "test", brand: "test", address: destination.address }));
      } catch (error) { return Response.json({ error: error.message }, { status: error.status || 500 }); }
    } };`, resolveDir: process.cwd(), sourcefile: "worker-check.ts", loader: "ts" },
  bundle: true, write: false, format: "esm", platform: "neutral", external: ["cloudflare:workers"],
});
let upstreamCalls = 0;
let redirectResponse = false;
const worker = new Miniflare({
  modules: true, script: outputFiles[0].text, compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"], bindings, cf: false,
  ...(live ? {} : { outboundService: async request => {
    upstreamCalls++;
    const url = new URL(request.url);
    assert.equal(url.origin, "https://maps.apigw.ntruss.com");
    assert.equal(request.headers.get("x-ncp-apigw-api-key-id"), "test-client");
    assert.equal(request.headers.get("x-ncp-apigw-api-key"), "test-secret");
    if (redirectResponse) return new WorkerResponse(null, { status: 302, headers: { Location: "https://never-follow.invalid/" } });
    if (url.pathname === "/map-geocode/v2/geocode") {
      assert.equal(url.searchParams.get("count"), "1");
      return WorkerResponse.json({ addresses: [{ x: "127.1", y: "37.2", roadAddress: "test address" }] });
    }
    assert.equal(url.pathname, "/map-direction/v1/driving");
    assert.equal(url.searchParams.get("option"), "traoptimal");
    return WorkerResponse.json({ code: 0, route: { traoptimal: [{ summary: { duration: 600000, distance: 8000, tollFare: 0 } }] } });
  } }),
});
try {
  const probe = await (await worker.dispatchFetch("http://worker.test/probe-redirect")).json();
  assert.match(probe.error, /Invalid redirect value/);
  console.log("Confirmed: workerd rejects redirect:error before any network request.");
  const geocoded = await worker.dispatchFetch("http://worker.test/geocode");
  assert.equal(geocoded.status, 200, "Geocoding must succeed in workerd");
  const point = await geocoded.json();
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  const driven = await worker.dispatchFetch("http://worker.test/driving");
  assert.equal(driven.status, 200, "Directions must succeed in workerd");
  const route = await driven.json();
  assert.ok(route.durationMs > 0 && route.distanceM > 0 && route.checkedAt);
  if (!live) {
    redirectResponse = true;
    const before = upstreamCalls;
    const redirected = await worker.dispatchFetch("http://worker.test/geocode");
    assert.equal(redirected.status, 502);
    assert.equal(upstreamCalls, before + 1, "Redirect must not forward credentials");
  }
  console.log(JSON.stringify({ runtime: "workerd", mode: live ? "live NAVER" : "mocked upstream", geocoding: "PASS", directions: "PASS", redirectsBlocked: live ? "tested separately" : "PASS", ...(live ? { checkedAt: route.checkedAt, durationMinutes: Math.ceil(route.durationMs / 60000) } : {}) }));
} finally { await worker.dispose(); }
