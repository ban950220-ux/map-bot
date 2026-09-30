import assert from 'node:assert/strict';
import { Response } from 'miniflare';

// Synthetic locations only. Never load .env, keyring or production credentials.
export const ORIGIN = { x: 127.4, y: 37.27, address: '테스트 출발 도로 100' };
export const OTHER_ORIGIN = { x: 127.402, y: 37.272, address: '테스트 출발 도로 200' };
export const LONG_NAME = '테스트 아주 긴 이름의 카페와 베이커리 문화공간 한글영문ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LONG_ADDRESS = '테스트시 테스트구 매우긴도로이름 12345 테스트복합문화상가 동관 이층 안쪽 별관';
export const docs = Array.from({ length: 15 }, (_, i) => ({
  id: String(i + 1), place_name: i === 14 ? LONG_NAME : `테스트 카페 ${i + 1}`,
  x: String(ORIGIN.x + (i + 1) * .0002), y: String(ORIGIN.y + (i + 1) * .0002),
  address_name: LONG_ADDRESS, road_address_name: LONG_ADDRESS,
  category_name: '음식점 > 카페', phone: '', place_url: `http://place.map.kakao.com/${i + 1}`,
}));
const places = (documents) => Response.json({ meta: { is_end: true, total_count: documents.length, pageable_count: documents.length }, documents });
export function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}
export function createUpstream() {
  const state = {
    calls: [], blocked: [], active: 0, peak: 0, finished: 0, placesFinished: [],
    failures: new Set(), fatal: null, holdRoutes: null, holdPlaces: null,
    longText: false,
  };
  async function fetch(request) {
    const url = new URL(request.url), p = url.searchParams;
    if (url.hostname === 'dapi.kakao.com') {
      assert.equal(request.headers.get('authorization'), 'KakaoAK fixture-kakao');
      if (!p.has('x')) {
        state.calls.push({ op: 'origin', query: p.get('query') });
        return places((p.get('query') === '모호한 공공장소' ? [ORIGIN, OTHER_ORIGIN] : [ORIGIN]).map((o, i) => ({
          ...docs[i], id: `origin-${i}`, place_name: `테스트 공공장소 ${i + 1}`, x: String(o.x), y: String(o.y), road_address_name: o.address,
        })));
      }
      if (p.get('category_group_code') === 'PK6') {
        state.calls.push({ op: 'pk6' });
        return places([{ ...docs[0], id: '8001', place_name: '테스트 인근 공영주차장', category_name: '교통 > 주차장' }]);
      }
      const query = p.get('query'), category = p.get('category_group_code');
      state.calls.push({ op: 'places', query, category, x: Number(p.get('x')), y: Number(p.get('y')), radius: p.get('radius'), page: p.get('page') });
      const hold = state.holdPlaces;
      if (hold && hold.query === query) await hold.gate.promise; // intentionally late even after client cancellation
      state.placesFinished.push(query);
      if (query === '없는장소') return places([]);
      if (query === '한곳') return places([docs[0]]);
      if (query === '스타벅스') return places([
        ...docs.slice(0, 3),
        ...docs.slice(3, 6).map((d, i) => ({ ...d, place_name: `스타벅스 테스트${i + 1}점` })),
      ]);
      if (query === '검색A' || query === '검색B') return places(docs.map(d => ({ ...d, place_name: `${query} ${d.id}` })));
      return places(state.longText ? docs.map(d => ({ ...d, place_name: `${LONG_NAME} ${d.id}` })) : docs);
    }
    if (url.origin !== 'https://maps.apigw.ntruss.com') {
      state.blocked.push({ host: url.hostname, path: url.pathname });
      return Response.json({ error: 'Unexpected outbound request blocked by test harness' }, { status: 502 });
    }
    assert.equal(request.headers.get('x-ncp-apigw-api-key'), 'fixture-secret');
    if (url.pathname === '/map-geocode/v2/geocode') {
      const query = p.get('query'); state.calls.push({ op: 'geocode', query });
      const o = query === OTHER_ORIGIN.address ? OTHER_ORIGIN : ORIGIN;
      return Response.json({ addresses: /공공장소/.test(query) ? [] : [{ x: String(o.x), y: String(o.y), roadAddress: o.address }] });
    }
    assert.equal(url.pathname, '/map-direction/v1/driving');
    const id = Math.round((Number(p.get('goal').split(',')[0]) - ORIGIN.x) / .0002);
    const option = p.get('option'); assert.ok(['trafast', 'traoptimal'].includes(option));
    state.calls.push({ op: 'route', id, start: p.get('start'), option });
    state.active++; state.peak = Math.max(state.peak, state.active);
    const hold = state.holdRoutes;
    try {
      if (hold && hold.ids.includes(id)) await hold.gate.promise;
      else await new Promise(resolve => setTimeout(resolve, 15));
      if (state.fatal && id >= 5) return Response.json({ error: { errorCode: '400' } }, { status: state.fatal });
      if (state.failures.has(id)) return Response.json({ error: 'fixture upstream failure' }, { status: 500 });
      return Response.json({ code: 0, route: { [option]: [{
        summary: { duration: (option === 'traoptimal' ? 10 : 16 - id) * 60000, distance: (option === 'traoptimal' ? 5 : id + 1) * 1000, tollFare: 0 },
        path: [[ORIGIN.x, ORIGIN.y], p.get('goal').split(',').map(Number)],
      }] } });
    } finally { state.active--; state.finished++; }
  }
  return { state, fetch };
}
