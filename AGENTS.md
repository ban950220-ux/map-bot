# MAP — AI 공통 개발 규칙

이 파일이 저장소 개발 규칙의 단일 관리 위치다. Codex, Claude Code, Gemini CLI, Copilot, Cursor는 같은 규칙을 따른다. 개별 AI 파일은 이 파일로 연결하는 얇은 진입점이며 숨겨진 대화·전역 설정은 인수 조건이 아니다. 사용자의 현재 지시가 우선한다.

1. 먼저 `AI_HANDOFF.md`, `docs/source-provenance.json`, `ARCHITECTURE.md`, `development.json`을 읽는다. 기본 브랜치가 최신이라고 가정하지 않는다.
2. 최신 원격 ref·열린 PR을 재확인하고 `ai/<tool>/<task>` 독립 브랜치에서 작업한다. 기본 브랜치 직접 쓰기, force push, 타인의 변경 삭제·덮어쓰기는 금지한다.
3. 기존 동작·데이터 형식·인증·Decimal·owner 격리·중복 방지·실패 의미를 보존한다. 필요 부분만 수정하고 전체 재작성·프레임워크 교체를 하지 않는다.
4. 실제 키·쿠키·토큰·비밀번호·계좌 데이터·개인 DB를 GitHub, PR, CI, 테스트 fixture 또는 외부 AI 입력으로 옮기지 않는다. 모의 테스트에는 합성 자료만 쓴다.
5. 제공자 요청·실제 메시지·주문·운영 설정·일정·DB 변경은 오프라인 검증과 분리한다. 검증 명령에 운영 loop를 넣지 않는다. 유료 사용은 비용·상한·무료 대안을 제시한 별도 승인이 필요하다.
6. `python scripts/dev.py --list`에 있는 실제 명령을 사용한다. 실행하지 않은 테스트, 다른 AI, 신규 환경, CI 또는 운영 반영을 성공으로 보고하지 않는다. 미지원 타입 검사·린트를 성공하는 가짜 명령으로 만들지 않는다.
7. 코드 수정 → 검증 → PR → 리뷰 → 사용자 승인 후 병합 → 별도 승인 후 배포 순서다. CI는 배포 권한·비밀정보 없이 실행한다. GitHub SHA와 운영 버전 ID를 별도로 기록한다.
8. 적용된 DB migration은 수정하지 않는다. 원본 DB 삭제·마이그레이션·복구 덮어쓰기·배포·스케줄 변경은 별도 승인이다. 독립 이전 후보는 새 대상과 합성 DB에서 검증한다.
9. 충돌 시 최신 head를 확인하고 제3자 작업을 보존한다. 복구는 새 revert PR로 수행하며 운영 데이터 복원은 코드 revert와 구분한다.

- 런타임·지도 제공자·CSV·인증·데이터·운영 기능은 이번 작업에서 변경하지 않는다.
- 실제 Android 설치와 운영 provider 연동은 기존 확인과 새 검증을 구분한다.

## 보존한 프로젝트별 제약

# 가까운 한 끼 — 프로젝트별 작업 규칙

프로젝트 불변 조건은 아래에 보존한다. 특정 AI의 전역 파일은 필수 의존성이 아니다.

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

변경 범위에 따라 이 파일의 공통 규칙과 함께 다음 검사를 적용한다.

- TypeScript 또는 서버 변경: `npm run build`, `npx tsc --noEmit`
- 주변 검색 로직 변경: `node scripts/check-nearby.mjs`
- 정적 검사: `npm run lint`
- UI/state/API flow 변경: `npm run test:browser` (빌드 포함, mock upstream, 실제 provider 호출 없음). suite 자체 변경은 `npm run test:browser:repeat`로 retry 없이 3회 반복한다. 설치/한계는 `BROWSER_ACCEPTANCE.md` 참조.
- 실제 provider 검증: `node scripts/check-nearby.mjs --live` (요청 범위에 포함되고 이 파일의 외부 작업 규칙의 조건을 충족할 때만)

현재 구현·검증 상태는 `PROJECT_CONTEXT.md`, 구조와 데이터 흐름은 `ARCHITECTURE.md`, 열린 작업은 `TASKS.md`, 설치·실행법은 `README.md`를 기준으로 한다.
