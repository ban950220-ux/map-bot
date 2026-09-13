# Project Context

## Project Purpose

`가까운 한 끼`는 개인용 지도/경로 탐색 웹사이트다. 하나의 목적지를 먼저 정하는 길찾기가 아니라, 출발지와 장소 category 또는 검색어를 입력하면 주변 후보를 찾고 각 후보까지의 실제 자동차 경로·교통 반영 ETA·도로거리를 계산해 비교한다.

## Current Status

- 주변 장소 탐색과 기존 단일 목적지/저장 매장 비교가 모두 구현되어 있다. 주변 탐색이 기본 제품 흐름이다.
- 출발지 주소가 NAVER Geocoding에서 확인되지 않으면 Kakao Local 장소명 검색으로 보완한다. 유효한 장소가 여러 개면 첫 결과를 확정하지 않고 사용자가 선택한다.
- `주차 가능한 카페` 같은 입력은 POI 검색어 `카페`와 주차 조건으로 분리한다. 최종 표시 후보의 매장 자체 주차는 Google Places API (New)로 보강하고, 인근 주차장은 Kakao PK6를 검색 영역당 한 번 조회해 500m 이내 최근접 결과를 별도로 표시한다.
- 주변 탐색은 최대 200 km, Kakao 응답 내 최대 30개 후보, 요청당 최대 4개 경로를 처리한다.
- 중단 시 완료된 결과를 sessionStorage checkpoint에 보존하고 30분 안에는 남은 후보부터 재개할 수 있다.
- 지도 SDK 초기화·overlay 표시 실패는 지도 영역의 오류로 격리되어 장소 목록과 경로 비교를 중단시키지 않는다. 지도는 첫 경로 결과가 나온 뒤 초기화한다.
- OpenAI Sites 프로젝트가 등록되어 있고 `.openai/hosting.json`에 기존 `project_id`가 있다. D1/R2는 비활성화 상태다.
- 2026-09-13 기준 build, TypeScript 검사, ESLint, mock upstream을 사용한 workerd 회귀 검사는 통과한다.
- 2026-09-14 production은 Sites secret revision 11과 version 14를 사용한다. 상태 API의 NAVER/Kakao/Google 연결 값은 모두 true지만 NAVER Geocoding이 upstream 401 Authentication Failed로 거부되어 Directions·지도·Google 주차 enrichment와 결과 카드 기반 모바일 smoke test는 현재 blocked 상태다.
- production URL은 `https://my-drive-time-ban357.ban950220.chatgpt.site`이며 owner-only 접근을 유지한다.
- canonical Git remote는 private GitHub repository `https://github.com/ban950220-ux/map-bot.git`이며 기본 개발 branch는 `main`이다. 이전 로컬 checkout remote는 `legacy-origin`으로 보존한다.

## Tech Stack

- Node.js 22 이상, npm (`package-lock.json`)
- TypeScript 5.9, React 19, Next.js 16 호환 Vinext, Vite 8
- Cloudflare Workers / Wrangler, OpenAI Sites
- Tailwind CSS 4, shadcn 계열 UI components, Zod
- Drizzle/D1 scaffold는 있으나 실제 DB table과 binding은 없음

## Repository Structure

- `app/`: root page/layout, styling, ChatGPT auth helper, API route handlers
- `components/`: 주변 탐색·지도·legacy 화면과 공용 UI primitives
- `services/maps/`: 장소 검색, 지오코딩 adapter, 경로 계산, ranking, schema, TTL cache
- `lib/`: NAVER client, API auth/error helper, client orchestration, WebMCP, 저장 매장 데이터
- `scripts/`: build/runtime 지원 및 mock/live 회귀 검사
- `db/`, `drizzle/`, `examples/d1/`: 현재 비활성인 DB scaffold와 opt-in 예제
- `.openai/hosting.json`: 기존 Sites 프로젝트와 binding 선언
- `AGENTS.md`, `ARCHITECTURE.md`, `TASKS.md`: 영구 작업 규칙, 구조, backlog
- `IMPLEMENTATION.md`: 2026-09-10 주변 탐색 구현의 상세 기록

## Implemented Features

- 주소 또는 사용자 승인 GPS 좌표를 출발지로 사용
- 주소 실패 시 장소명 기반 출발지 검색 fallback과 복수 결과 선택
- Kakao Local keyword/category 검색과 반경 확대(1/3/5/10/20/50/100/150/200 km)
- 최대 3페이지·30개 후보 수집, 중복/반경 밖/비의도 주차장 결과 억제
- 자연어 주차 조건과 POI 검색어 분리, 관련도·직선거리 균형 후보 구성
- `storeParking`과 `nearbyParking`을 분리하고 주차 조건 검색 때만 PK6 영역 조회 1회 후 local spatial matching
- Google 이름·주소·좌표 보수적 매칭과 `parkingOptions` 기반 최종 표시 후보 매장 주차 보강
- NAVER Geocoding 및 Directions 5 `trafast` 자동차 경로 조회
- 후보 경로 최대 4개 동시 계산, timeout/abort/부분 실패 처리
- 교통 ETA순, 도로거리순, 검색 관련도순, ETA 80% + 거리 20% 추천순 정렬
- 카드의 전화번호·직선거리·장소 출처·주차 확인 상태와 CSV export
- 모든 후보 marker와 선택한 한 후보의 경로 visualization
- 검색 중단과 sessionStorage 기반 30분 내 재개
- 기존 저장 양꼬치 56곳 및 직접 입력 목적지 비교 보존
- API의 ChatGPT 사용자 header 확인, cross-site request 거부, Zod 입력 검증
- WebMCP 도구 `compare_nearby_places`, `compare_live_driving_times` 등록
- isolate-local TTL cache: 지오코딩/장소 5분, 경로 45초

## Partially Implemented Features

- 지도 SDK는 NAVER Dynamic Map 활성화와 배포 도메인 등록이 필요하다. 미설정이어도 목록 비교는 계속 동작한다.
- Kakao Local과 NAVER Maps는 매장 자체 주차 여부를 제공하지 않는다. Google Places가 확실히 매칭되고 하나 이상의 `parkingOptions`가 true일 때만 `storeParking=available`이며, 그 외에는 `unknown`이다. PK6 인근 주차장은 매장 주차로 승격하지 않는다.
- Kakao PK6는 장소 기본정보만 제공해 요금·운영시간·구획 수를 채우지 않는다. 전국주차장표준데이터 연동은 서비스 키와 운영 범위 결정이 없어 미구현이다.
- D1/Drizzle 파일은 starter scaffold뿐이며 schema와 hosted binding이 없다.
- `RoutingProvider`에는 미래 walking/bicycling/transit type과 matrix interface가 있지만 현재 구현은 NAVER 자동차 단건 경로뿐이다.
- WebMCP는 코드에 등록되어 있으나 지원 브라우저에서 end-to-end 검증되지 않았다.

## Current Architecture

브라우저의 React Client Components가 same-origin API routes를 호출한다. API는 Sites가 전달한 ChatGPT 사용자 header를 확인하고 입력을 검증한 뒤, 서버에서만 Kakao/NAVER/Google API를 호출한다. 장소 후보는 직선거리로 필터링하고, 후보별 NAVER 경로 결과는 교통 ETA와 도로거리로 정렬한 다음 최종 표시 후보만 Google 매장 주차정보로 보강한다. 상세 구조는 `ARCHITECTURE.md`를 참조한다.

## Core Data Flow

`주소·장소명 또는 GPS → NAVER Geocoding 후 필요 시 Kakao 장소명 fallback/복수 결과 선택 → 검색의도 분리 → Kakao 후보 검색 → 관련도·Haversine 필터/중복 제거 → (주차 조건이면 PK6 영역 조회 1회와 후보별 local matching) → 4개씩 NAVER 자동차 경로 요청 → 부분 성공 결과 → ETA/도로거리/관련도/추천 정렬 → 최종 표시 N개 Google Places 매장 주차 보강 → 목록·지도·CSV`

중단 시 완료된 후보의 route path를 제거한 checkpoint만 sessionStorage에 저장하고, 재개 시 미완료 후보만 다시 조회한다.

## External Services

- Kakao Local REST API: keyword/category 기반 후보 검색과 PK6 인근 주차장 영역 조회
- NAVER Maps Geocoding: 주소를 좌표로 변환
- NAVER Directions 5: 자동차 경로, 도로거리, 교통 반영 ETA
- NAVER Maps JavaScript SDK: browser map/marker/path rendering
- Google Places API (New): 최종 표시 후보의 매장 자체 주차 `parkingOptions` 보강
- ChatGPT/Sites authentication headers: 사용자 식별 및 비공개 API 접근

서비스가 제공하지 않는 평점·리뷰·영업 상태는 생성하지 않는다.

## Database / Data Model

- 운영 DB 없음. `.openai/hosting.json`의 `d1`과 `r2`는 `null`이다.
- `db/schema.ts`는 의도적으로 비어 있고 `db/index.ts`는 미래 D1 binding용 helper다.
- `lib/stores.json`은 legacy 비교용 정적 매장 목록이다.
- 주요 runtime entity는 `Point`, `DestinationCandidate`, `PlaceSearchResult`, `RouteData`, `NearbySnapshot`이며 API/메모리/sessionStorage에서만 사용된다.

## Environment

필수 runtime 변수 이름:

- `NAVER_MAPS_CLIENT_ID`
- `NAVER_MAPS_CLIENT_SECRET`
- `KAKAO_REST_API_KEY`
- `GOOGLE_PLACES_API_KEY`

실제 값은 저장소에 두지 않는다. 배포에서는 Sites secret runtime entries로 관리한다. `.env.example`에는 이름만 있다.

## How to Run

```bash
npm ci
npm run dev
```

개발 서버 기본 포트는 5173이다. 로컬 UI 실행은 Windows credential manager의 운영 키를 자동으로 주입하지 않는다. production-compatible build 후 local Worker는 `npm run start`로 실행한다.

## How to Test

```bash
npm run build
npx tsc --noEmit
node scripts/check-nearby.mjs
npm run lint
```

`check-nearby.mjs` 기본 모드는 mock upstream을 workerd에서 실행하며 실제 API key나 호출량을 쓰지 않는다. Google matching/options/failure/timeout/concurrency도 fixture로 검증한다. 실제 API는 credential과 과금 가능성이 있으므로 범위·비용에 대한 명시적 허용이 있을 때만 실행한다.

## Known Issues

- Google Places의 한국 매장 coverage가 불완전할 수 있어, 매칭되더라도 `parkingOptions`가 없으면 `확인 필요`다.
- PK6 인근 주차장 조회는 최대 15개와 500m local matching이므로 검색 영역의 모든 주차장을 보장하지 않는다.
- 실제 기기 GPS 권한 허용과 비로그인 브라우저의 화면 응답은 자동화 환경에서 직접 확인하지 않았다. GPS 거부 및 API 인증 차단은 regression fixture로 검증한다.
- 캐시는 isolate-local이므로 인스턴스 간 공유, 지속성, 전역 rate limiting을 제공하지 않는다.
- 200 km 검색도 Kakao가 반환한 최대 45개 POI 중 필터된 최대 30개만 비교하므로 전역 최적을 보장하지 않는다.

## Current Priorities

1. Sites의 `NAVER_MAPS_CLIENT_ID`/`NAVER_MAPS_CLIENT_SECRET` 값이 같은 NAVER Maps Application의 유효한 쌍인지 확인해야 한다. 서버는 현재 공식 `naveropenapi.apigw.ntruss.com` endpoint와 필수 인증 header를 사용하며 production 응답은 명확한 HTTP 401이다.
2. NAVER 인증 정상화 뒤 Directions, Dynamic Map, Google 주차 표본과 360/390/430px 결과 카드 smoke test를 다시 수행한다. Google runtime 연결 상태 자체는 true다.
3. 전국주차장표준데이터와 shared cache는 필요성이 생길 때만 optional로 검토한다.

## Recommended Next Tasks

- `TASKS.md`의 Future / Optional 항목은 실제 필요성이 생길 때만 검토한다.
- 다른 환경에서는 canonical GitHub repository를 clone하고 `main`을 기준으로 작업한다. `legacy-origin`은 이 PC의 과거 checkout 보존용이다.

## Important Constraints

- NAVER Directions 5는 matrix가 아니다. 후보별 호출과 최대 4개 concurrency를 유지한다.
- 직선거리는 후보 필터, 도로거리는 route 비교다. 둘을 같은 값처럼 표시하지 않는다.
- 부분 실패·중단 결과를 완전한 순위로 표시하지 않는다.
- secret은 서버에서만 사용하며 browser에는 NAVER public Client ID 외의 credential을 전달하지 않는다.
- ChatGPT 인증, 기존 Sites `project_id`, owner-only 접근 범위를 완화하거나 변경하지 않는다.
- 실제 DB가 필요하기 전에는 D1 schema/migration을 추가하지 않는다.
