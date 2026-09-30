# Tasks

이 문서는 미완료 작업과 우선순위만 관리한다. 완료된 구현과 검증 상태는 `PROJECT_CONTEXT.md`, 구조적 제약은 `ARCHITECTURE.md`를 기준으로 한다.

## Release Gate

- [ ] **P1** browser suite에서 발견한 후속 runtime 수정의 기존 Sites 배포 승인 및 제한된 production 확인
  - v20 자체는 완료된 안정 baseline이다. 후속 변경은 완전히 시도된 부분 실패의 재개 버튼 복구, 긴 영문 상호명 줄바꿈, 결과/progress 접근성 이름이다.
  - GitHub push는 Sites 배포가 아니다. 별도 승인 전 v20을 유지하며 새 Site/auth 변경은 금지한다.
  - 승인 후 기존 project에서 검색/partial resume/mobile을 확인한다. rollback point version 19 및 현재 v20을 보존한다.
- [ ] **P2** Android Chromium PWA 실기기 검증
  - [x] 기존 `project_id`, owner-only 접근, production URL을 유지한 version 20이 기준선이다.
  - [x] 인증된 production에서 개인정보 링크의 클릭 이동과 Vinext RSC prefetch 오류 해소를 확인했다.
  - [x] production HTML의 manifest 링크와 `crossorigin="use-credentials"`를 확인했다. 비인증 manifest·아이콘 요청은 owner-only 경계에 따라 401이다.
  - [ ] 인증된 Android Chromium에서 manifest·192/512/maskable 아이콘의 실제 로드와 규격을 확인한다.
  - 실제 Android Chromium에서 앱 설치 항목, 전용 아이콘, standalone 실행, 인증과 핵심 화면을 확인하기 전에는 설치형 Web App 완료로 판정하지 않는다.
  - `ANDROID_ACCEPTANCE.md`의 최소 checklist를 사용하고 정확한 GPS/계정 정보를 artifact에 남기지 않는다.

## Browser acceptance 이후의 외부 검증

- [ ] **P2** 네이티브 WebMCP 지원 host에서 discovery → 실제 호출 E2E
  - 도구 2개의 등록/실행/schema/Google 필드 제거는 deterministic browser contract shim으로 완료했다.
  - shim PASS를 네이티브 플랫폼 PASS로 취급하지 않는다. 실사용 provider 호출 비용을 먼저 확인한다.

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

- [ ] **P2** 실제 기기 GPS 권한 smoke test
  - synthetic allowed/denied/timeout/unsupported browser regression과 별도로 `ANDROID_ACCEPTANCE.md`를 따른다.
  - 사용자 승인 하에 수행하고 credential 값이나 개인 위치를 test artifact에 저장하지 않는다.

- [ ] **P3** 전국주차장표준데이터 optional integration 검토
  - 서비스 키와 운영 범위가 결정되기 전에는 credential이나 값을 만들지 않는다.
  - 요금·운영시간·구획 수를 보완하더라도 매장 자체 주차로 취급하지 않는다.

- [ ] **P3** fuzzy dedup·추천 점수 안정성 product decision
  - 인접한 실제 지점을 합치지 않는 fixture와 추천 score의 절대 scale/cap 정책을 먼저 결정한다.
