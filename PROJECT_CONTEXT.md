# Project Context

이 문서는 현재 구현, 검증 결과, 운영 상태와 알려진 한계를 기록하는 snapshot이다. 구조와 데이터 흐름은 `ARCHITECTURE.md`, 열린 작업은 `TASKS.md`, 설치·실행·검사법은 `README.md`를 기준으로 한다.

## Project Purpose

`가까운 한 끼`는 개인용 지도/경로 탐색 웹사이트다. 하나의 목적지를 먼저 정하는 길찾기가 아니라, 출발지와 장소 category 또는 검색어를 입력하면 주변 후보를 찾고 각 후보까지의 실제 자동차 경로·교통 반영 ETA·도로거리를 계산해 비교한다.

## Current Status

- 주변 장소 탐색과 기존 단일 목적지/저장 매장 비교가 모두 구현되어 있다. 주변 탐색이 기본 제품 흐름이다.
- 출발지 주소가 NAVER Geocoding에서 확인되지 않으면 Kakao Local 장소명 검색으로 보완한다. 유효한 장소가 여러 개면 첫 결과를 확정하지 않고 사용자가 선택한다.
- `주차 가능한 카페` 같은 입력은 POI 검색어 `카페`와 주차 조건으로 분리한다. 매장 자체 주차는 `unknown`으로 유지하고, Kakao PK6 인근 주차장을 검색 영역당 한 번 조회해 500m 이내 최근접 결과로 별도 표시한다.
- 주변 탐색은 최대 200 km, Kakao 응답 내 최대 30개 후보, 요청당 최대 4개 경로를 처리한다.
- 중단 시 완료된 결과를 sessionStorage checkpoint에 보존하고 30분 안에는 남은 후보부터 재개할 수 있다.
- 지도 SDK 초기화·overlay 표시 실패는 지도 영역의 오류로 격리되어 장소 목록과 경로 비교를 중단시키지 않는다. 지도는 첫 경로 결과가 나온 뒤 초기화한다.
- OpenAI Sites 프로젝트가 등록되어 있고 `.openai/hosting.json`에 기존 `project_id`가 있다. D1/R2는 비활성화 상태다.
- Production 안정 baseline은 version **20**, commit `41968b86a30c51e8406faf9c02fa66f83f0215ca`다. 작업 시작 시 local/GitHub main의 일치를 확인했다. 기존 Sites project는 `appgprj_6aa13e471abc819193188a4999e314f6`, rollback point는 version 19다.
- 2026-09-29 감사 안정화 변경(Google Places active enrichment/export 제거, resume identity, 상호명 관련도, 결과 우선 UI, stale 안내, NAVER quota/throttle 구분)은 v20 배포 완료 기준선에 포함된다. 사용자가 제공한 v20 검증 기록은 owner-only/auth, 일반/브랜드/주차 검색, ETA/거리, Dynamic Map, 390/1200px, PWA assets PASS와 console error 0이다. 이번 작업에서는 live provider/production을 재검사하지 않았다.
- `ARCHITECTURE.md`에 PII 없는 observability allowlist, provider 호출 상한, retry 판단 기준을 기록했다. 운영 logging과 자동 retry는 retention·latency·failure rate를 측정하기 전에는 추가하지 않는다.
- 2026-09-30 로컬 build, TypeScript, ESLint, mock workerd 회귀가 PASS이며 browser 32개 case를 retry 없이 3회 반복해 96/96 PASS(약 2.2분)를 확인했다. 로컬은 Node 24, CI clean install 검증 대상은 Node 22다.
- `tests/browser`의 Playwright + 실제 빌드 Worker/API + mock upstream acceptance를 추가했다. 32개 case가 핵심 A–M, CSV, WebMCP contract, legacy, GPS fallback, PWA, 5개 viewport를 다룬다. 실제 provider 호출과 Google active 호출은 0이어야 하며 retry 없이 반복한다. 상세 구조/한계는 `BROWSER_ACCEPTANCE.md`에 기록했다.
- Suite가 완전히 시도된 부분 실패를 완료로 저장해 재개 버튼이 사라지는 P1 버그를 재현했다. 성공 후보 수로 완료를 판정하고 실패 후보만 재시도하도록 최소 수정했다. 360/390px 긴 영문 상호명 줄바꿈과 결과/progress 접근성 이름도 보완했다. 이 후속 runtime 수정은 **production에 배포하지 않았다**.
- GitHub Actions `Offline CI`는 Node 22 clean install, build, TypeScript, mock 지도 회귀, lint, Chromium browser acceptance를 실행한다. Sites 배포와 별개이며 production secret을 사용하지 않는다.
- 2026-09-18 production version 18에는 Vinext RSC prefetch 오류를 피하는 native 내부 링크, precise-location 기본값을 제거한 빈 출발지 UI, `가까운 한 끼` 전용 Web App manifest, 192/512 PNG 아이콘, maskable 아이콘이 배포되어 있다. owner-only 인증이 필요한 manifest를 브라우저가 credential과 함께 요청하도록 `crossorigin="use-credentials"`를 적용했다.
- 과거 기록: 2026-09-14의 version 15에서는 Google 매장 주차 보강도 검증했으나, 이 흐름은 현재 v20에 적용되지 않는다. Google은 현재 active flow에서 disabled다.
- 2026-09-18 owner-only production 읽기 전용 smoke test에서 인증된 검색 화면과 provider 연결 상태, WebMCP 도구 등록, 개인정보 링크의 실제 클릭 이동, manifest 링크와 `use-credentials` 속성을 확인했다. version 18 배포 후 인증된 `/`와 manifest·192/512/maskable 아이콘은 모두 200이고 제거한 개인 출발지가 HTML에 없으며, 비인증 `/`와 manifest 요청은 401로 인증 경계를 유지한다.
- owner-only browser smoke test에서 360/390/430/768/1200px의 horizontal overflow가 없고 목록이 지도보다 먼저 노출되는 것을 확인했다. 부분 실패·중단·재개와 GPS 거부는 regression fixture로 확인했으며 실제 기기 GPS는 아직 미검증이다.
- 두 WebMCP 도구의 등록·실제 callback→API 실행은 browser contract shim으로 검증한다. 네이티브 ChatGPT/browser의 discovery·호출 E2E는 **NOT RUN — environment limitation**이며 shim 통과와 구분한다.
- production URL은 `https://my-drive-time-ban357.ban950220.chatgpt.site`이며 owner-only 접근을 유지한다.
- 이전 version 18의 Google active flow 배포 gate는 v20으로 해소됐다. Android Chromium 실제 설치·standalone·GPS는 미검증이며 `ANDROID_ACCEPTANCE.md`의 checklist를 따른다. 현재 production의 owner-only/access/hosting binding은 변경하지 않았다.
- canonical Git remote는 `https://github.com/ban950220-ux/map-bot.git`이며 기본 개발 branch는 `main`이다. 2026-09-18 GitHub 연결 메타데이터는 repository visibility를 `public`으로 반환하므로, owner-only Sites 접근과 source repository 공개범위를 동일한 것으로 간주하지 않는다. 현재 source에서는 개인 precise-location 기본값을 주변 탐색·legacy UI와 live 진단 fixture에서 제거했으며 UI 출발지는 빈 값에서 시작한다. 이전 로컬 checkout remote는 `legacy-origin`으로 보존한다.

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
- `tests/browser/`, `playwright.config.mjs`: credential-free 실제 UI/API browser acceptance
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
- keyword 상호명이 직접 일치하면 일반 업종 후보를 최종 경로 비교 pool에서 제외하고, category 검색은 거리순 유지
- `storeParking`과 `nearbyParking`을 분리하고 주차 조건 검색 때만 PK6 영역 조회 1회 후 local spatial matching
- 매장 자체 주차 `unknown`과 Kakao PK6 인근 주차장을 분리 표시. 이전 Google matching 코드는 dormant이며 active UI/API에서 호출하지 않음
- NAVER Geocoding 및 Directions 5 `trafast` 자동차 경로 조회
- 후보 경로 최대 4개 동시 계산, timeout/abort/부분 실패 처리
- 교통 ETA순, 도로거리순, 검색 관련도순, ETA 80% + 거리 20% 추천순 정렬
- 카드의 전화번호·직선거리·장소 출처·주차 확인 상태와 CSV export
- 모든 후보 marker와 선택한 한 후보의 경로 visualization
- 검색 중단과 sessionStorage 기반 30분 내 재개. 실패 후보는 재시도하되 auth/quota/throttle fatal checkpoint는 자동·즉시 재개하지 않음
- 기존 저장 양꼬치 56곳 및 직접 입력 목적지 비교 보존
- API의 ChatGPT 사용자 header 확인, cross-site request 거부, Zod 입력 검증
- WebMCP 도구 `compare_nearby_places`, `compare_live_driving_times` 등록
- isolate-local TTL cache: 지오코딩/장소 5분, 경로 45초

## Partially Implemented Features

- 지도 SDK는 NAVER Dynamic Map 활성화와 배포 도메인 등록이 필요하다. 미설정이어도 목록 비교는 계속 동작한다.
- Kakao Local과 NAVER Maps는 매장 자체 주차 여부를 제공하지 않는다. 현재 active flow는 Google Places를 호출하지 않으므로 `storeParking=unknown`을 유지한다. PK6 인근 주차장은 매장 주차로 승격하지 않는다.
- Kakao PK6는 장소 기본정보만 제공해 요금·운영시간·구획 수를 채우지 않는다. 전국주차장표준데이터 연동은 서비스 키와 운영 범위 결정이 없어 미구현이다.
- D1/Drizzle 파일은 starter scaffold뿐이며 schema와 hosted binding이 없다.
- `RoutingProvider`에는 미래 walking/bicycling/transit type과 matrix interface가 있지만 현재 구현은 NAVER 자동차 단건 경로뿐이다.
- WebMCP contract E2E는 mock upstream으로 검증하지만 네이티브 지원 browser/host E2E는 미검증이다.
- 설치형 Web App용 manifest와 192/512/maskable 아이콘은 production version 17에 배포됐고 인증된 HTML의 credentialed manifest 연결까지 확인했다. 실제 Android Chromium의 아이콘 로드·앱 설치·standalone 실행·인증 흐름 검증은 남아 있어 그 전에는 설치 완료로 판정하지 않는다.

## Known Issues

- GitHub repository visibility가 현재 `public`으로 확인되지만 기존 프로젝트 문서는 `private`을 전제로 했다. 과거 Git history에는 현재 source에서 제거된 개인 기본값이 남아 있을 수 있으며, history rewrite/force push 또는 repository visibility 변경은 별도 명시적 결정 없이는 수행하지 않는다. 코드상 secret은 server-only 경계를 유지하되, source repository 공개범위 자체는 별도 명시적 결정 없이 변경하지 않는다.
- Google Places Content를 non-Google map과 함께 표시하거나 CSV/WebMCP로 export하지 않도록 active enrichment를 비활성화했다. 정책에 맞는 별도 UI와 비용 범위가 결정되기 전에는 재활성화하지 않는다.
- PK6 인근 주차장 조회는 최대 15개와 500m local matching이므로 검색 영역의 모든 주차장을 보장하지 않는다.
- 실제 기기 GPS 권한 허용과 비로그인 브라우저의 화면 응답은 자동화 환경에서 직접 확인하지 않았다. GPS 거부 및 API 인증 차단은 regression fixture로 검증한다.
- 캐시는 isolate-local이므로 인스턴스 간 공유, 지속성, 전역 rate limiting을 제공하지 않는다.
- 200 km 검색도 Kakao가 반환한 최대 45개 POI 중 필터된 최대 30개만 비교하므로 전역 최적을 보장하지 않는다.
