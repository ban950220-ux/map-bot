import assert from 'node:assert/strict';
import { isAndroidUserAgent, naverAndroidDirectionsUrl, naverWebDirectionsUrl } from '../lib/naverDirectionsLink.ts';

const originA = { x: 127.0276368, y: 37.4979502, address: '조회된 주소' };
const destinationA = { longitude: 127.1230074, latitude: 37.5209436, name: '올림픽 공원 & 카페/1' };
const originNameA = '강남역 / 2번 출구 & 앞';
const site = 'https://example.chatgpt.site';
assert.equal(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 8)'), true);
assert.equal(isAndroidUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);

const androidA = naverAndroidDirectionsUrl(originA, originNameA, destinationA, site);
const appUrl = new URL(androidA.slice(0, androidA.indexOf('#Intent')));
assert.equal(appUrl.protocol, 'intent:');
assert.equal(appUrl.hostname, 'route');
assert.equal(appUrl.pathname, '/car');
assert.deepEqual(Object.fromEntries(appUrl.searchParams), {
  slat: '37.4979502', slng: '127.0276368', sname: originNameA,
  dlat: '37.5209436', dlng: '127.1230074', dname: destinationA.name,
  appname: site,
});
assert.ok(androidA.endsWith('#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end'));
assert.ok(androidA.includes('%2F') && androidA.includes('%26') && androidA.includes('%EA'));

const webA = new URL(naverWebDirectionsUrl(originA, originNameA, destinationA));
assert.equal(webA.origin, 'https://map.naver.com');
const [, , , start, end, via, mode] = webA.pathname.split('/');
assert.equal(via, '-');
assert.equal(mode, 'car');
function checkSegment(segment, longitude, latitude, name) {
  const [x, y, encodedName, id, type] = segment.split(',');
  const rad = Math.PI / 180;
  assert.ok(Math.abs(Number(x) - 6378137 * longitude * rad) < 0.001);
  assert.ok(Math.abs(Number(y) - 6378137 * Math.log(Math.tan(Math.PI / 4 + latitude * rad / 2))) < 0.001);
  assert.equal(decodeURIComponent(encodedName), name);
  assert.equal(id, '');
  assert.equal(type, 'ADDRESS_POI');
}
checkSegment(start, originA.x, originA.y, originNameA);
checkSegment(end, destinationA.longitude, destinationA.latitude, destinationA.name);

const originB = { x: 126.9522394, y: 37.464007, address: '다음 조회 주소' };
const destinationB = { longitude: 127.1053971, latitude: 37.3595953, name: '그린팩토리' };
const androidB = naverAndroidDirectionsUrl(originB, '서울대학교', destinationB, site);
const second = new URL(androidB.slice(0, androidB.indexOf('#Intent')));
assert.equal(second.searchParams.get('sname'), '서울대학교');
assert.equal(second.searchParams.get('slat'), '37.464007');
assert.equal(second.searchParams.get('dname'), '그린팩토리');
assert.ok(!androidB.includes(encodeURIComponent(originNameA)));
assert.ok(!naverWebDirectionsUrl(originB, '서울대학교', destinationB).includes(encodeURIComponent(destinationA.name)));

console.log('PASS NAVER Android intent, desktop route URL, coordinate order, names/encoding, repeated searches');
