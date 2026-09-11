# Tasks

## Now

- [ ] 기존 ESLint 오류를 동작 변경 없이 해결
  - `npm run lint`가 error/warning 없이 통과한다.
  - root 내부 navigation은 framework Link를 사용한다.
  - checkpoint 초기화와 map SDK loading의 effect가 불필요한 동기 state cascade를 만들지 않는다.
  - NAVER map global의 최소 타입을 정의해 explicit `any`를 제거한다.
  - `npm run build`, `npx tsc --noEmit`, `node scripts/check-nearby.mjs`가 계속 통과한다.

- [ ] owner-only 환경의 핵심 browser smoke test
  - 주소 기반 후보 검색과 결과 정렬을 확인한다.
  - marker와 선택 route path가 표시되며 map 인증 실패 시 목록 기능이 유지된다.
  - 한 후보 실패와 사용자 중단/재개가 성공 결과를 지우지 않는다.
  - 실제 기기 GPS를 시험하지 못하면 미검증 범위를 명시한다.
  - test 중 사용한 API source와 검증 시각을 기록하되 credential은 기록하지 않는다.

## Next

- [ ] WebMCP runtime 검증
  - 지원 브라우저에서 두 도구의 등록과 schema validation을 확인한다.
  - UI와 동일한 API/auth/error semantics를 사용하는지 확인한다.
  - unsupported browser에서 일반 UI가 회귀하지 않는다.

- [ ] package metadata 정리
  - starter package name을 프로젝트 식별 가능한 이름으로 변경한다.
  - dependency version이나 lockfile dependency graph는 불필요하게 바꾸지 않는다.
  - build/typecheck/regression test를 통과한다.

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

## Blocked

- [ ] 실제 GPS와 hosted map/WebMCP end-to-end 확인
  - Blocker: 실제 device permission, 등록된 배포 domain, 지원 browser가 필요하다.
  - credential 값이나 개인 위치는 test artifact에 저장하지 않는다.
