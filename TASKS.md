# Tasks

이 문서는 미완료 작업과 우선순위만 관리한다. 완료된 구현과 검증 상태는 `PROJECT_CONTEXT.md`, 구조적 제약은 `ARCHITECTURE.md`를 기준으로 한다.

## Release Gate

- [ ] **P0** 2026-09-29 감사 안정화 변경을 기존 Sites project에 배포하고 production 검증
  - Google Places active enrichment/export가 production에서 제거됐는지 확인한다.
  - 기존 `project_id`, owner-only 접근, production URL, 인증·검색·부분 실패·지도 분리를 유지한다.
  - local 검증 완료 후 별도 배포 승인을 받아야 한다.
- [ ] **P2** Android Chromium PWA 실기기 검증
  - [x] 기존 `project_id`, owner-only 접근, production URL을 유지해 version 18까지 배포했다.
  - [x] 인증된 production에서 개인정보 링크의 클릭 이동과 Vinext RSC prefetch 오류 해소를 확인했다.
  - [x] production HTML의 manifest 링크와 `crossorigin="use-credentials"`를 확인했다. 비인증 manifest·아이콘 요청은 owner-only 경계에 따라 401이다.
  - [ ] 인증된 Android Chromium에서 manifest·192/512/maskable 아이콘의 실제 로드와 규격을 확인한다.
  - 실제 Android Chromium에서 앱 설치 항목, 전용 아이콘, standalone 실행, 인증과 핵심 화면을 확인하기 전에는 설치형 Web App 완료로 판정하지 않는다.

## 지금 반드시 필요한 것

- [ ] **P2** deterministic browser acceptance suite
  - 모호한 출발지, 중단→즉시 재개, 조건 변경, 두 번째 검색, marker↔card, map SDK 실패, 390px를 포함한다.
  - credential 없는 CI에서 mock provider로 실행하고 live smoke와 분리한다.

## 측정 후 판단할 것

- [ ] **P2** production logging 도입 판단
  - 실제 logging 추가 전 Sites/Worker 보존 기간과 접근 범위를 확인한다.
  - 주소·좌표·검색어·장소명·user header는 기록하지 않는다.

- [ ] 실제 failure/latency와 전체 request budget 측정 후 bounded retry 재검토
  - 사용자 abort는 retry하지 않고 auth/quota도 retry하지 않는다.

- [ ] 공유 cache 또는 persistence 필요성 평가
  - isolate-local cache의 실제 miss/cost를 측정한다.
  - D1/R2를 단순 scaffold 존재만으로 활성화하지 않는다.
  - 개인 위치·검색 이력의 보존 기간과 삭제 정책을 먼저 결정한다.

## 나중에 해도 되는 것

- [ ] **P2** WebMCP end-to-end 실행 검증
  - Google 유래 필드가 반환되지 않고 UI와 같은 auth/abort/partial 의미를 유지하는지 확인한다.

- [ ] **P2** 실제 기기 GPS 권한 smoke test
  - 사용자 승인 하에 수행하고 credential 값이나 개인 위치를 test artifact에 저장하지 않는다.

- [ ] **P3** 전국주차장표준데이터 optional integration 검토
  - 서비스 키와 운영 범위가 결정되기 전에는 credential이나 값을 만들지 않는다.
  - 요금·운영시간·구획 수를 보완하더라도 매장 자체 주차로 취급하지 않는다.

- [ ] **P3** fuzzy dedup·추천 점수 안정성 product decision
  - 인접한 실제 지점을 합치지 않는 fixture와 추천 score의 절대 scale/cap 정책을 먼저 결정한다.
