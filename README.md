# 가까운 한 끼

출발지와 장소 검색어를 입력하면 주변 후보를 찾고, 각 후보까지의 실제 자동차 경로·교통 반영 ETA·도로거리를 비교하는 개인용 지도 탐색 사이트입니다. 기존 저장 매장과 직접 입력 목적지를 비교하는 화면도 별도 탭으로 유지합니다.

## 핵심 동작

- Kakao Local로 category/keyword 후보 검색
- NAVER Geocoding과 Directions 5로 실제 자동차 경로 계산
- 최대 30개 후보, 후보 4개씩 제한 병렬 조회
- 주소뿐 아니라 장소명 출발지와 사용자 승인 GPS 지원, 동명 장소는 사용자 선택
- 시간순, 도로거리순, 검색 관련도순, ETA 80% + 거리 20% 추천순
- `주차 가능한 카페` 같은 검색어에서 POI와 주차 조건 분리
- 매장 자체 주차는 확인되지 않으면 `unknown` 유지하고, 인근 주차장과 분리
- 주차 조건 검색 시 Kakao PK6 인근 주차장을 매장 자체 주차와 분리해 표시
- 카드에서 전화번호, 도로거리, 직선거리, 장소 출처 비교
- 부분 실패, 중단, 30분 내 이어하기
- NAVER 지도 marker/route와 CSV 내보내기
- 프로젝트 전용 manifest와 192/512/maskable 아이콘을 사용하는 설치형 Web App 기반
- Sites/ChatGPT 사용자 header를 확인하는 개인용 API

Directions 5는 다중 목적지 행렬 API로 사용하지 않습니다. 직선거리는 후보 필터에만 쓰고 최종 비교에는 자동차 경로의 도로거리와 ETA를 사용합니다.

## Requirements

- Node.js 22.13 이상
- npm과 `package-lock.json`
- runtime secret: `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET`, `KAKAO_REST_API_KEY`
- 지도 화면에는 NAVER Dynamic Map 활성화와 배포 domain 등록 필요

실제 secret은 repository에 저장하지 않습니다. 이름은 `.env.example`을 참고하고 배포 값은 Sites의 secret runtime entries에서 관리합니다.

## Install and Run

```bash
npm ci
npm run dev
```

개발 서버 기본 포트는 5173입니다. `npm run dev`는 Windows credential manager의 운영 키를 자동 주입하지 않습니다. production-compatible build를 만든 뒤 local Worker를 실행하려면 다음을 사용합니다.

```bash
npm run build
npm run start
```

## Validation

```bash
npm run build
npx tsc --noEmit
node scripts/check-nearby.mjs
npm run lint
npx playwright install chromium
npm run test:browser
npm run test:browser:repeat
```

기본 주변 검색 검사는 mock Kakao/NAVER 응답을 workerd에서 사용하며, dormant Google matching helper도 실제 네트워크 없이 회귀 검사합니다. active 검색 flow는 Google Places를 호출하거나 그 데이터를 CSV/WebMCP로 내보내지 않습니다. 정렬 변경이나 카드·marker 선택도 provider를 재호출하지 않습니다.

Browser acceptance는 실제 빌드 UI → 실제 Worker API → mock upstream을 사용합니다. provider secret이나 실제 API 호출 없이 32개 case를 실행하며 race, partial/resume, checkpoint identity, 브랜드 ranking, Google zero-call을 고정합니다. `test:browser`는 먼저 build하고, `test:browser:repeat`는 retry 없이 3회 반복합니다. 이미 build한 뒤 특정 테스트만 실행하려면 `npx playwright test --grep "E/F"`를 사용합니다. CI의 Node 22/Ubuntu에는 `npx playwright install --with-deps chromium`이 필요합니다.

단위/mock(Layer 1), browser/mock(Layer 2), 승인된 production live smoke(Layer 3)는 서로 대체하지 않습니다. 설정·fixture·CI·실패 artifact 정책과 SDK/WebMCP 한계는 [BROWSER_ACCEPTANCE.md](BROWSER_ACCEPTANCE.md), 실제 Android 확인은 [ANDROID_ACCEPTANCE.md](ANDROID_ACCEPTANCE.md)를 참고하세요.

실제 provider를 확인할 때는 필요한 credential을 설정한 뒤 다음 명령을 사용합니다. 이 검사는 실제 API 사용량과 비용이 발생할 수 있습니다.

로컬 Windows keyring helper는 `MAP_CREDENTIAL_PYTHON`(또는 `PYTHON`)에 지정된 Python을 우선 사용하고, 없으면 `python`을 사용합니다. 선택한 Python 환경에는 `keyring`이 설치되어 있어야 하며 실제 credential 값은 파일이나 로그에 기록하지 않습니다.

```bash
node scripts/check-nearby.mjs --live
```

최근 검증 결과와 provider 정책에 따른 매장 주차 기능의 현재 상태는 `PROJECT_CONTEXT.md`에 기록합니다.

Web App manifest와 192/512/maskable 아이콘, credentialed manifest 연결은 production에서 확인됐다. 실제 Android Chromium의 아이콘 로드·앱 설치·standalone 실행·인증 흐름까지 확인해야 최종 완료입니다. installability만을 위한 service worker나 가짜 설치 prompt는 사용하지 않습니다.

## Project Documents

- Codex 전역 `AGENTS.md`와 `%USERPROFILE%\.codex\rules\`: 모든 저장소에 공통인 작업 규칙
- `AGENTS.md`: 이 저장소에만 적용되는 제약과 검증 항목
- `PROJECT_CONTEXT.md`: 현재 구현·검증·문제의 snapshot
- `ARCHITECTURE.md`: 시스템 구성과 데이터 흐름
- `TASKS.md`: 미완료 작업의 우선순위와 acceptance criteria
- `IMPLEMENTATION.md`: 주변 탐색 구현의 상세 배경
- `BROWSER_ACCEPTANCE.md`: v20 기준선과 deterministic browser suite
- `ANDROID_ACCEPTANCE.md`: 설치·standalone·GPS 실기기 checklist (아직 미검증)

## Repository

canonical remote는 `https://github.com/ban950220-ux/map-bot.git`이고 기본 개발 branch는 `main`입니다. 2026-09-18 GitHub 연결 메타데이터는 현재 repository visibility를 `public`으로 반환합니다. 이는 owner-only Sites 접근과 별개이며, 공개범위 자체는 명시적 결정 없이 변경하지 않습니다. 새 환경에서는 이 repository를 clone한 뒤 위 설치·검증 절차를 따릅니다. 이 PC의 `legacy-origin`은 이전 local checkout을 가리킵니다. Sites project와 배포 상태는 `PROJECT_CONTEXT.md`를 참조합니다.
