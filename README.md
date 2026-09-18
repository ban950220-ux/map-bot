# 가까운 한 끼

출발지와 장소 검색어를 입력하면 주변 후보를 찾고, 각 후보까지의 실제 자동차 경로·교통 반영 ETA·도로거리를 비교하는 개인용 지도 탐색 사이트입니다. 기존 저장 매장과 직접 입력 목적지를 비교하는 화면도 별도 탭으로 유지합니다.

## 핵심 동작

- Kakao Local로 category/keyword 후보 검색
- NAVER Geocoding과 Directions 5로 실제 자동차 경로 계산
- 최대 30개 후보, 후보 4개씩 제한 병렬 조회
- 주소뿐 아니라 장소명 출발지와 사용자 승인 GPS 지원, 동명 장소는 사용자 선택
- 시간순, 도로거리순, 검색 관련도순, ETA 80% + 거리 20% 추천순
- `주차 가능한 카페` 같은 검색어에서 POI와 주차 조건 분리
- 최종 표시 후보의 매장 자체 주차를 Google Places API (New) `parkingOptions`로 보강하고, 확인되지 않은 값은 `unknown` 유지
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
- runtime secret: `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`
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

기본 주변 검색 검사는 mock Kakao/NAVER/Google 응답을 workerd에서 사용합니다. Google `parkingOptions`는 표시 개수만큼 요청되며, 정렬 변경이나 marker 선택은 재호출하지 않습니다.

실제 provider를 확인할 때는 필요한 credential을 설정한 뒤 다음 명령을 사용합니다. 이 검사는 실제 API 사용량과 비용이 발생할 수 있습니다.

```bash
node scripts/check-nearby.mjs --live
```

최근 검증 결과와 Google 매장 주차 보강의 현재 상태는 `PROJECT_CONTEXT.md`에 기록합니다.

Web App manifest와 192/512/maskable 아이콘, credentialed manifest 연결은 production에서 확인됐다. 실제 Android Chromium의 아이콘 로드·앱 설치·standalone 실행·인증 흐름까지 확인해야 최종 완료입니다. installability만을 위한 service worker나 가짜 설치 prompt는 사용하지 않습니다.

## Project Documents

- Codex 전역 `AGENTS.md`와 `%USERPROFILE%\.codex\rules\`: 모든 저장소에 공통인 작업 규칙
- `AGENTS.md`: 이 저장소에만 적용되는 제약과 검증 항목
- `PROJECT_CONTEXT.md`: 현재 구현·검증·문제의 snapshot
- `ARCHITECTURE.md`: 시스템 구성과 데이터 흐름
- `TASKS.md`: 미완료 작업의 우선순위와 acceptance criteria
- `IMPLEMENTATION.md`: 주변 탐색 구현의 상세 배경

## Repository

canonical remote는 `https://github.com/ban950220-ux/map-bot.git`이고 기본 개발 branch는 `main`입니다. 2026-09-18 GitHub 연결 메타데이터는 현재 repository visibility를 `public`으로 반환합니다. 이는 owner-only Sites 접근과 별개이며, 공개범위 자체는 명시적 결정 없이 변경하지 않습니다. 새 환경에서는 이 repository를 clone한 뒤 위 설치·검증 절차를 따릅니다. 이 PC의 `legacy-origin`은 이전 local checkout을 가리킵니다. Sites project와 배포 상태는 `PROJECT_CONTEXT.md`를 참조합니다.
