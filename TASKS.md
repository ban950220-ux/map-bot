# Tasks

## Release Complete

- [x] 기존 ESLint 오류를 동작 변경 없이 해결
  - `npm run lint`가 error/warning 없이 통과한다.
  - root 내부 navigation은 framework Link를 사용한다.
  - checkpoint 초기화와 map SDK loading의 effect가 불필요한 동기 state cascade를 만들지 않는다.
  - NAVER map global의 최소 타입을 정의해 explicit `any`를 제거한다.
  - `npm run build`, `npx tsc --noEmit`, `node scripts/check-nearby.mjs`가 계속 통과한다.

- [x] owner-only 환경의 핵심 browser smoke test
  - 주소·장소명 기반 후보 검색, 주차 조건 분리와 결과 정렬을 확인한다.
  - marker와 선택 route path가 표시되며 map 인증 실패 시 목록 기능이 유지된다.
  - 한 후보 실패와 사용자 중단/재개가 성공 결과를 지우지 않는다.
  - 실제 기기 GPS를 시험하지 못하면 미검증 범위를 명시한다.
  - test 중 사용한 API source와 검증 시각을 기록하되 credential은 기록하지 않는다.

  - production에서 ChatGPT owner 접근, 상태 API, 장소명 선택, Kakao 검색, NAVER 경로·지도, 주차 분리, marker/list 연동을 확인했다.
  - 360/390/430/768/1200px에서 horizontal overflow 없이 목록이 지도보다 먼저 노출되는 것을 확인했다.
  - 부분 실패·중단·재개와 GPS 거부는 browser에 고의 장애를 만들지 않고 regression fixture로 확인했다.

- [x] 주차정보 의미 분리와 Kakao PK6 보완
  - 매장 자체 주차는 `storeParking`, 인근 주차장은 `nearbyParking`으로 분리한다.
  - 주차 조건 검색 때 영역 조회 1회 후 후보별 local matching을 사용한다.
  - 직접 확인할 수 없는 매장 주차는 계속 `unknown`으로 유지한다.

- [x] Google Places API (New) 매장 자체 주차 enrichment
  - Kakao 후보와 Google 결과의 이름·주소·좌표를 보수적으로 대조한다.
  - 최종 표시 후보에만 최대 3개 concurrency로 Text Search를 호출하며 정렬·marker 선택 때 재호출하지 않는다.
  - `parkingOptions`의 true 항목만 `available` 근거로 사용하고, 누락·false-only·실패는 `unknown`으로 유지한다.
  - Google `storeParking`과 Kakao PK6 `nearbyParking`을 분리하고 Google Maps attribution을 표시한다.

- [x] package metadata 정리
  - package name을 `map-bot`으로 변경하고 dependency graph는 유지했다.
  - build/typecheck/lint/regression을 통과했다.

- [x] WebMCP runtime 등록 검증
  - 지원되는 ChatGPT in-app browser에서 `compare_nearby_places` 등록과 최신 relevance schema 노출을 확인했다.
  - unsupported browser에서도 일반 UI가 독립적으로 동작한다.

## Production Blockers

- [ ] Sites production provider 연결 재검증
  - 최신 secret revision 9로 기존 version 12를 재배포했지만 NAVER Geocoding이 upstream 401/403으로 거부된다.
  - 같은 로컬 NAVER credential은 HTTP 200이므로 Sites에 저장된 ID/Secret 쌍과 NAVER Application의 Geocoding·Directions 5 활성화를 다시 확인한다.
  - `GOOGLE_PLACES_API_KEY` entry는 존재하지만 production 상태의 `parkingConnected`가 false다. 실제 runtime 값이 비어 있지 않은지 다시 확인한다.
  - 연결 정상화 후 Directions, Dynamic Map, Google 주차 표본, 360/390/430px 결과 카드 smoke test를 완료한다.

## Future / Optional

- [ ] 전국주차장표준데이터 optional integration 검토
  - 서비스 키와 운영 범위가 결정되기 전에는 credential이나 값을 만들지 않는다.
  - 요금·운영시간·구획 수를 보완하더라도 매장 자체 주차로 취급하지 않는다.

- [ ] API 관측 가능성 설계
  - secret, 주소, 개인정보를 기록하지 않는 최소 오류 category와 request correlation 방식을 정한다.
  - Kakao/NAVER auth, quota, timeout, partial failure를 구분한다.
  - 실제 logging 추가 전 Sites/Worker 보존 기간과 접근 범위를 확인한다.

## Later

- [ ] provider rate-limit/backoff 정책 검토
  - 실제 provider 제한과 비용 근거가 있을 때만 추가한다.
  - partial failure와 사용자 abort semantics를 보존한다.

- [ ] 공유 cache 또는 persistence 필요성 평가
  - isolate-local cache의 실제 miss/cost를 측정한다.
  - D1/R2를 단순 scaffold 존재만으로 활성화하지 않는다.
  - 개인 위치·검색 이력의 보존 기간과 삭제 정책을 먼저 결정한다.

- [ ] automated browser test 도입 여부 평가
  - map SDK를 제외한 deterministic flow와 실제 provider smoke test를 분리한다.
  - credential 없는 CI에서 mock test가 실행 가능해야 한다.

- [ ] 실제 기기 GPS 권한 smoke test
  - 현재 위치가 필요한 문제가 보고될 때 사용자 승인 하에 수행한다.
  - credential 값이나 개인 위치는 test artifact에 저장하지 않는다.
