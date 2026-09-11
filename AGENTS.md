# 가까운 한 끼 — 저장소 작업 규칙

이 저장소가 프로젝트의 Single Source of Truth다. 이전 대화보다 현재 저장소의 코드, 설정, 테스트 결과와 아래 문서를 우선한다.

## 세션 시작 절차

의미 있는 작업을 시작하기 전에 다음 순서로 확인한다.

1. `AGENTS.md`를 읽는다.
2. `PROJECT_CONTEXT.md`를 읽는다.
3. 구조나 외부 서비스 흐름을 바꿀 때 `ARCHITECTURE.md`를 읽는다.
4. `TASKS.md`에서 현재 우선순위와 이미 알려진 문제를 확인한다.
5. 요청과 관련된 실제 source/config/schema/tests를 확인한다.
6. `git status --short --branch`와 현재 branch를 확인한다.
7. 기존 uncommitted changes를 사용자 작업으로 간주하고 보호한다.
8. 문서의 설명을 실제 구현과 비교한다.

작은 문구 수정처럼 범위가 분명한 작업은 필요한 파일만 추가로 읽는다. 저장소에 `.codegraph/`가 있으면 코드 위치와 호출 경로를 찾을 때 CodeGraph를 먼저 사용한다.

## Source of Truth 우선순위

사용자의 최신 명시적 지시가 항상 가장 우선한다. 그 다음 판단 기준은 아래 순서다.

`실제 source/config/schema` → `tests와 실제 검증 결과` → `PROJECT_CONTEXT.md` → `ARCHITECTURE.md` → `README.md`/`TASKS.md` → 이전 대화

문서와 코드가 충돌하면 코드를 기준으로 문서를 고친다. 실행하지 않은 기능이나 검증하지 않은 결과를 구현·통과로 기록하지 않는다.

## 개발 루프

기능 구현이나 버그 수정은 가능한 범위에서 다음 흐름으로 끝까지 수행한다.

`Inspect → Understand → Plan → Implement → Test → Debug → Regression check → Documentation update → Report`

첫 실패만으로 중단하지 않는다. 로그, 오류, 호출 흐름을 확인해 합리적으로 해결할 수 있는 문제는 계속 조사한다. 외부 credential, 비용, 실제 배포, 되돌릴 수 없는 데이터 작업이 필요하면 안전한 지점에서 멈추고 blocker를 명확히 남긴다.

## 변경 정책

- 요청을 해결하는 최소한의 robust change를 선호한다.
- 기존 사용자 코드, public interface, API contract, branch/history, 호환성을 가능한 한 보존한다.
- 불필요한 architectural rewrite, dependency 교체, schema 변경, dead-code 정리를 하지 않는다.
- 새 dependency, D1/R2, 외부 API, 데이터 스키마는 요청에 꼭 필요할 때만 추가한다.
- 사용자 uncommitted changes를 삭제하거나 덮어쓰지 않는다.
- `git reset --hard`, history rewrite, force push를 사용하지 않는다.
- `.openai/hosting.json`의 `project_id`와 기존 비공개 접근 범위를 보존한다.
- 제품 source나 배포를 다룰 때 Sites 지침을 따른다. 문서·Codex 설정만 바꿀 때는 사이트를 배포하지 않는다.

## 프로젝트 고유 경계

- 서버 전용 비밀을 Client Component, 응답 본문, 로그, 문서에 넣지 않는다.
- ChatGPT 인증을 완화하거나 우회하지 않는다.
- NAVER Directions 5를 1×N 행렬 API로 취급하지 않는다. 현재 최대 4개 제한 병렬 처리와 abort/부분 실패 의미를 보존한다.
- 직선거리(후보 필터)와 도로거리(경로 결과), 일반 시간과 교통 반영 ETA를 구분한다.
- Kakao/NAVER가 제공하지 않은 평점, 리뷰, 영업 상태를 생성하지 않는다.
- 현재 캐시는 Worker isolate-local best-effort 캐시다. 영속 저장이나 전역 rate limiter로 설명하지 않는다.
- 실제 금융 거래, 계좌 관리, 뉴스 수집, LLM 분석 기능이 있는 프로젝트로 오인하지 않는다.

## 테스트 정책

변경 범위에 맞춰 기존 테스트, targeted test, lint, typecheck, build, 관련 runtime validation을 수행한다.

- TypeScript/서버 변경: `npm run build`와 `npx tsc --noEmit`
- 주변 검색 로직 변경: `node scripts/check-nearby.mjs`
- 정적 검사: `npm run lint` (현재 알려진 실패는 `PROJECT_CONTEXT.md`와 `TASKS.md` 참조)
- 실제 API 검증: `node scripts/check-nearby.mjs --live` (사용자가 명시하고 credential/API 사용량을 허용한 경우만)

테스트하지 못한 항목은 이유와 함께 보고하며, 테스트했다고 주장하지 않는다. 실제 API, 브라우저 E2E, 비공개 사이트 배포, 접근 범위 변경은 사용자 요청 없이 실행하지 않는다.

## 문서 지속성 정책

의미 있는 작업을 마치면 `PROJECT_CONTEXT.md`를 현재 상태로 갱신한다. 구조·제약이 바뀌면 `ARCHITECTURE.md`, 우선순위나 blocker가 바뀌면 `TASKS.md`, 사용자 실행 절차가 바뀌면 `README.md`도 함께 수정한다.

`PROJECT_CONTEXT.md`는 무한한 작업일지가 아니라 현재 상태의 간결한 snapshot으로 유지한다. 오래되거나 충돌하는 설명은 누적하지 말고 교체한다.

## Git 정책

- 작업 시작 전 status, branch, upstream, remote를 확인한다.
- remote 상태 확인이 필요하면 fetch 전에 로컬 변경과 remote 종류를 확인한다.
- 기존 repository의 branch convention을 우선한다. convention이 없고 변경이 크면 `feature/` 또는 `chore/` branch를 고려한다.
- 의미 있는 단위로 commit하고 목적이 드러나는 commit message를 쓴다.
- remote divergence가 있으면 덮어쓰지 말고 원인을 분석한다.
- push 전에 관련 검증 상태와 commit 대상에 secret이 없는지 확인한다.
- force push와 history rewrite는 금지한다.

## 비밀 및 개인정보 정책

다음은 절대 commit하지 않는다: `.env`, API key, password, access/refresh token, private key, session cookie, credential file, 실제 개인정보가 든 local DB.

필요한 환경 변수는 `.env.example`에 이름과 빈 값만 기록한다. 비밀 값은 읽거나 출력하지 않는다. 이미 history에 들어간 secret을 발견해도 history를 임의로 rewrite하지 말고 노출된 credential의 rotation 필요성을 사용자에게 알린다.
