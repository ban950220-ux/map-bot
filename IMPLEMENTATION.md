# 다중 목적지 탐색 및 경로 비교 구현 보고서

## 2026-09-10 추가 수정: 최대 200km

반경 선택에 50/100/150/200km를 추가했습니다. 카카오 radius는 최대 20km이므로 그보다 넓은 요청은 구면 원을 포함하는 rect 영역으로 검색하고 Haversine 거리로 원 밖 후보를 제거합니다. API가 제공한 가까운 후보 최대 30곳이라는 제한은 유지합니다. UI·서버 입력 검증·WebMCP 반경과 후보 거리 검증을 함께 변경했습니다. 실제 200km 카테고리 검색, 기존 양꼬치/스타벅스 경로, 반경 상한 검증 및 모의 회귀 테스트를 통과했습니다.

운영 로그의 /api/status 401에 대응해 명시적인 최상위 ChatGPT 재로그인 링크와 연결 실패 상태를 추가했습니다. 서버의 인증 검사는 완화하지 않았습니다. 이후 로그에는 장소/경로 요청 200도 있어, 사용자 화면 오류 전체가 401 때문이라고 단정하지 않습니다. 지도 전용 오류 여부는 별도 확인이 필요합니다.

## 1. 기존 구조

Vinext/React 화면, Cloudflare Worker API, Sites 개인 계정 인증을 사용합니다. 기존에는 NAVER Geocoding과 Directions 5로 단일 도착지 또는 저장된 양꼬치 매장 56곳을 비교했습니다. 동적 장소 검색은 없었습니다. 기존 화면을 LegacyRoutes로 분리해 별도 탭에 보존했으며 기존 compare API와 매장 목록을 유지했습니다.

## 2. 사용 API

- 주소 변환: NAVER Geocoding (`maps.apigw.ntruss.com/map-geocode/v2/geocode`). 실제 주소 변환 성공을 확인했습니다.
- 후보 검색: Kakao Local keyword/category search. 일반 분류 카페·약국 등은 category, 상호·임의 검색어는 keyword를 사용합니다.
- 자동차 경로: NAVER Directions 5. 새로운 주변 비교는 `trafast`, 기존 비교는 기존 기본 `traoptimal`을 유지합니다.
- 지도 화면: NAVER Maps JavaScript SDK. 공개 Client ID만 브라우저로 전달하고 Secret과 Kakao REST 키는 서버에만 둡니다.

## 3. Matrix 지원

사용 중인 Directions 5는 목적지 전체의 1×N 행렬을 반환하지 않습니다. 여러 goal을 넣어도 그중 최소 비용 목적지 하나만 반환하므로 Matrix 대체로 사용하지 않습니다. 최대 4개 동시 요청으로 구현했고, provider가 getRouteMatrix를 지원하면 교체 가능한 인터페이스를 마련했습니다.

## 4. 실시간 교통

NAVER의 실시간 빠른 길 옵션을 사용합니다. 시간은 API summary.duration(ms), 도로거리는 summary.distance(m)입니다. API가 반환한 실제 경로만 표시합니다. 조회 시각과 45초 경로 캐시를 안내하며, 지속적인 위치 추적이나 실시간 자동 새로고침 기능은 아닙니다.

## 5. 변경 파일

- app/page.tsx: 주변 검색/기존 비교 탭.
- app/layout.tsx: 스타일 및 설명.
- app/api/geocode/route.ts: 캐시 어댑터 연결.
- app/api/status/route.ts: 연결 상태와 지도 SDK 공개 ID.
- lib/naver.ts: 선택적 경로 옵션과 실제 path 반환, 기존 호출 호환.
- lib/types.ts: 선택적 path.
- .env.example, README.md: 설정·안내. tsconfig.tsbuildinfo: 컴파일 검사 산출물.

## 6. 새 파일

- components/LegacyRoutes.tsx, NearbyExplorer.tsx, NearbyMap.tsx.
- app/nearby.css, app/api/places/route.ts, app/api/nearby-routes/route.ts.
- services/maps/{types,cache,ranking,placeSearch,geocoding,routing,routeMatrix,schema}.ts.
- lib/nearby-client.ts, lib/nearby-webmcp.ts.
- scripts/check-nearby.mjs, maps-test-credentials.mjs, dev-maps.mjs.
- IMPLEMENTATION.md.

## 7. 데이터 흐름

주소 또는 사용자 승인 GPS 좌표 → 검색어/반경의 후보 15~30곳 → 중복·반경 밖 후보 제거 → 4개씩 자동차 경로 계산 → 성공한 DestinationCandidate 배열 → 독립적인 시간/도로거리 정렬 또는 정규화 ETA 80%·거리 20% 추천 점수 → Top N 리스트 및 A/B/C 지도 마커. 선택한 후보의 경로를 강조합니다. 반경은 1/3/5/10/20km, 결과 부족 시 선택에 따라 20km까지 확장합니다.

## 8. 최적화 및 보호

장소/주소 캐시 5분, 경로 캐시 45초, 캐시 용량 제한, 최대 30후보 및 4동시 요청. 정렬 변경 시 다시 API를 호출하지 않습니다. 취소·타임아웃·쿼터 오류를 처리하며 개별 실패는 다른 성공 결과를 지우지 않습니다. 매장 검색에서는 별도 주차장 POI를 제외하고 주차장 검색은 보존합니다. 서버 API 인증 및 엄격한 입력 검증을 적용했습니다. 키는 Sites secret 설정으로 저장합니다.

## 9. 테스트 결과 (2026-09-10)

- 실제 API/Worker: 이천 출발 양꼬치 15후보 모두 경로 성공, 시간 순 정렬 통과. 20:08 KST 조회 예: 미향부 약 7분/2.67km. 이후 교통에 따라 달라집니다.
- 실제 API: 스타벅스 도로거리 정렬 통과. 첫 검증에서 별도 주차장이 포함되어 매장 검색 필터를 추가했습니다.
- 실제 API: 1km 양꼬치 0곳 → 5km 확장으로 15곳 확보.
- 모의 API: 5곳 중 1곳을 강제 실패시켜 나머지 4곳 보존, 동시 요청 최대 4개 확인.
- 모의 API: 캐시, 만료, 중복, 빈 결과, 쿼터, 입력 검증, GPS 좌표 전달, 위치 권한 거부, 중단 처리 통과.
- 기존 단일 도착지 라우팅 어댑터 실제 호출 통과. 배포용 빌드 성공.
- GPS는 테스트 좌표로 검증했습니다. 실제 기기 GPS 권한 및 지도 클릭·렌더링의 브라우저 E2E 검증은 수행하지 않았습니다. WebMCP 등록/실행 역시 지원 브라우저에서 별도 확인이 필요합니다.

## 10. 제약

Top N은 검색된 최대 30후보 내 순위이며 모든 장소 중 전역 최적을 보장하지 않습니다. 거리순은 빠른 자동차 경로의 실제 도로거리 비교이지 각 장소까지의 절대 최단거리 경로 탐색이 아닙니다. 평점·리뷰·영업 여부·폐업 여부는 현재 장소 API가 제공하지 않아 추정 표시하지 않습니다. 도달 불가능한 장소는 실패로 안내합니다. 캐시는 Worker 인스턴스 단위이며 전역 요금 제한 장치는 아닙니다. 지도 표시에는 NAVER Dynamic Map 활성화 및 사이트 도메인 등록이 필요합니다. 미설정이면 목록 비교는 동작하고 지도 인증 안내를 표시합니다. 보행/자전거/대중교통은 확장 타입만 있고 실제 제공하지 않습니다.

공식 참고: [NAVER Directions 5](https://api.ncloud-docs.com/docs/application-maps-directions5), [Kakao REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api), [NAVER 지도 SDK 설정](https://navermaps.github.io/maps.js.ncp/docs/tutorial-1-Getting-Client-ID.html).
