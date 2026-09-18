# 가까운 한 끼 — 프로젝트별 작업 규칙

Codex 전역 `AGENTS.md`와 `%USERPROFILE%\.codex\rules\`를 기본 규칙으로 적용한다. 이 파일은 이 저장소에만 필요한 제약과 검증 항목을 추가한다.

## 공통 사이트 baseline

사용자-facing 사이트와 PWA/installability 작업에는 `MASTER_SITE_BASELINE.md`를 적용한다. 실제 production 응답과 Android 설치·standalone 실행을 확인하기 전에는 설치 가능한 Web App 검증이 끝났다고 판정하지 않는다. 프로젝트 고유 규칙과 최신 사용자 지시가 baseline보다 우선한다.

## 프로젝트 불변 조건

- ChatGPT 인증을 완화하거나 우회하지 않는다.
- `.openai/hosting.json`의 기존 `project_id`와 owner-only 접근 범위를 보존한다.
- NAVER Directions 5를 1×N 행렬 API로 취급하지 않는다. 후보별 단건 호출과 API/UI의 최대 4개 동시 처리, abort 및 부분 실패 의미를 함께 보존한다.
- 후보 필터용 직선거리와 경로 결과의 도로거리, 일반 시간과 교통 반영 ETA를 구분한다.
- 매장 자체 주차(`storeParking`)와 인근 주차장(`nearbyParking`)을 구분한다. Kakao/NAVER/Google이 제공하지 않은 주차 가능 여부, 평점, 리뷰, 영업 상태를 생성하지 않는다.
- Google Places 응답과 여기서 파생한 주차정보는 cache나 storage에 보관하지 않는다.
- 현재 `TtlCache`는 Worker isolate-local best-effort cache다. 영속 저장소나 전역 rate limiter로 취급하지 않는다.
- 서버 전용 Kakao/NAVER/Google credential은 client response, log, browser storage에 노출하지 않는다. 브라우저에는 NAVER Maps JavaScript SDK용 public Client ID만 전달할 수 있다.
- 실제 DB 필요성이 확인되기 전에는 starter D1/Drizzle scaffold에 schema, migration, hosted binding을 추가하지 않는다.
- tracked source, test fixture, 문서에 사용자의 정확한 자택·개인 출발지 같은 precise location을 기본값으로 하드코딩하지 않는다. UI 기본값은 비워 두고, 테스트에는 synthetic fixture나 공개 장소를 사용한다.
- 특정 PC의 사용자명·절대 경로를 tracked source에 하드코딩하지 않는다. local-only executable 위치는 환경변수나 표준 PATH로 주입한다.

## 프로젝트 검증 명령

변경 범위에 따라 전역 테스트 규칙과 함께 다음 검사를 적용한다.

- TypeScript 또는 서버 변경: `npm run build`, `npx tsc --noEmit`
- 주변 검색 로직 변경: `node scripts/check-nearby.mjs`
- 정적 검사: `npm run lint`
- 실제 provider 검증: `node scripts/check-nearby.mjs --live` (요청 범위에 포함되고 전역 외부 작업 규칙의 조건을 충족할 때만)

현재 구현·검증 상태는 `PROJECT_CONTEXT.md`, 구조와 데이터 흐름은 `ARCHITECTURE.md`, 열린 작업은 `TASKS.md`, 설치·실행법은 `README.md`를 기준으로 한다.
