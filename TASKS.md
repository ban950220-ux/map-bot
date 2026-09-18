# Tasks

이 문서는 미완료 작업과 우선순위만 관리한다. 완료된 구현과 검증 상태는 `PROJECT_CONTEXT.md`, 구조적 제약은 `ARCHITECTURE.md`를 기준으로 한다.

## Release Gate

- [ ] 내부 링크·PWA 변경을 기존 Sites project에 배포하고 production 검증
  - [x] 기존 `project_id`, owner-only 접근, production URL을 유지해 version 17로 배포했다.
  - [x] 인증된 production에서 개인정보 링크의 클릭 이동과 Vinext RSC prefetch 오류 해소를 확인했다.
  - [x] production HTML의 manifest 링크와 `crossorigin="use-credentials"`를 확인했다. 비인증 manifest·아이콘 요청은 owner-only 경계에 따라 401이다.
  - [ ] 인증된 Android Chromium에서 manifest·192/512/maskable 아이콘의 실제 로드와 규격을 확인한다.
  - 실제 Android Chromium에서 앱 설치 항목, 전용 아이콘, standalone 실행, 인증과 핵심 화면을 확인하기 전에는 설치형 Web App 완료로 판정하지 않는다.

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
