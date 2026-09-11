# 가까운 한 끼

출발지와 장소 검색어를 입력하면 주변 후보를 찾고, 각 후보까지의 실제 자동차 경로·교통 반영 ETA·도로거리를 비교하는 개인용 지도 탐색 사이트입니다. 기존 저장 매장과 직접 입력 목적지를 비교하는 화면도 별도 탭으로 유지합니다.

## 핵심 동작

- Kakao Local로 category/keyword 후보 검색
- NAVER Geocoding과 Directions 5로 실제 자동차 경로 계산
- 최대 30개 후보, 후보 4개씩 제한 병렬 조회
- 시간순, 도로거리순, ETA 80% + 거리 20% 추천순
- 부분 실패, 중단, 30분 내 이어하기
- NAVER 지도 marker/route와 CSV 내보내기
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
```

기본 주변 검색 검사는 mock Kakao/NAVER 응답을 workerd에서 사용합니다. 실제 API 검증은 credential과 사용량이 필요하므로 명시적으로 승인한 경우에만 `node scripts/check-nearby.mjs --live`를 실행합니다.

2026-09-11 기준 build, typecheck, mock workerd 회귀 검사는 통과합니다. lint는 기존 10 errors/2 warnings가 있으며 상세 내용과 acceptance criteria는 `PROJECT_CONTEXT.md`와 `TASKS.md`에 있습니다.

## Repository as Project Memory

- `AGENTS.md`: 모든 AI 개발 세션의 영구 작업 규칙
- `PROJECT_CONTEXT.md`: 현재 구현·검증·문제의 snapshot
- `ARCHITECTURE.md`: 장기 유지해야 할 구성과 데이터 흐름
- `TASKS.md`: 우선순위와 acceptance criteria가 있는 backlog
- `IMPLEMENTATION.md`: 주변 탐색 구현의 상세 배경

새 세션은 위 문서와 실제 코드를 함께 확인하고, 의미 있는 변경 후 현재 상태 문서를 갱신해야 합니다.

## Deployment and Git

`.openai/hosting.json`에는 기존 private Sites 프로젝트가 등록되어 있습니다. `project_id`와 owner-only 접근 범위를 보존합니다. 문서만 바꾼 작업은 사이트를 배포하지 않습니다.

canonical remote는 private GitHub repository `https://github.com/ban950220-ux/map-bot.git`이고 기본 개발 branch는 `main`입니다. 새 환경에서는 이 repository를 clone한 뒤 위 설치·검증 절차를 따릅니다. 이전 로컬 checkout remote는 `legacy-origin`으로 보존하며, history를 rewrite하거나 force push하지 않습니다.
