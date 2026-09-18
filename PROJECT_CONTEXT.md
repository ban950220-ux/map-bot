# Project Context

이 문서는 현재 구현, 검증 결과, 운영 상태와 알려진 한계를 기록하는 snapshot이다. 구조와 데이터 흐름은 `ARCHITECTURE.md`, 열린 작업은 `TASKS.md`, 설치·실행·검사법은 `README.md`를 기준으로 한다.

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
- 2026-09-18 기준 build, TypeScript 검사, ESLint, mock upstream을 사용한 workerd 회귀 검사는 통과한다.
- GitHub Actions `Offline CI`는 Node 22 clean install, build, TypeScript, mock 지도 회귀, lint를 자동 실행하며 2026-09-18 첫 run #1이 성공했다.
- 2026-09-18 production version 17에는 Vinext RSC prefetch 오류를 피하는 native 내부 링크와 `가까운 한 끼` 전용 Web App manifest, 192/512 PNG 아이콘, maskable 아이콘이 배포되어 있다. owner-only 인증이 필요한 manifest를 브라우저가 credential과 함께 요청하도록 `crossorigin="use-credentials"`를 적용했다.
- 2026-09-14 production은 Sites secret revision 18과 version 15를 사용한다. NAVER Geocoding 인증 복구 후 `주차 가능한 카페` 검색에서 자동차 경로 15/15 성공, Dynamic Map의 후보 marker와 선택 경로선, 최종 표시 3곳의 Google 매장 주차 보강, Kakao PK6 인근 주차장 분리를 확인했다.
- 2026-09-18 owner-only production 읽기 전용 smoke test에서 인증된 검색 화면과 provider 연결 상태, WebMCP 도구 등록, 개인정보 링크의 실제 클릭 이동, manifest 링크와 `use-credentials` 속성을 확인했다. 비인증 `/`, `/api/status`, manifest·아이콘 요청은 모두 401로 인증 경계를 유지한다.
- owner-only browser smoke test에서 360/390/430/768/1200px의 horizontal overflow가 없고 목록이 지도보다 먼저 노출되는 것을 확인했다. 부분 실패·중단·재개와 GPS 거부는 regression fixture로 확인했으며 실제 기기 GPS는 아직 미검증이다.
- 지원되는 ChatGPT in-app browser에서 WebMCP 도구 등록과 relevance schema 노출을 확인했다. 도구의 전체 end-to-end 실행 검증은 남아 있다.
- production URL은 `https://my-drive-time-ban357.ban950220.chatgpt.site`이며 owner-only 접근을 유지한다.
- 핵심 지도 검색의 알려진 production blocker는 없다. 사이트 baseline 완료를 위해 실제 Android Chromium에서 manifest·아이콘 로드, 앱 설치 항목, 전용 아이콘, standalone 실행과 인증 후 핵심 화면을 검증해야 한다.
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
- 설치형 Web App용 manifest와 192/512/maskable 아이콘은 production version 17에 배포됐고 인증된 HTML의 credentialed manifest 연결까지 확인했다. 실제 Android Chromium의 아이콘 로드·앱 설치·standalone 실행·인증 흐름 검증은 남아 있어 그 전에는 설치 완료로 판정하지 않는다.

## Known Issues

- 현재 production Site source version 17은 precise-location 기본값 제거 commit 이전 소스다. owner-only 접근은 유지되지만, Git `main`의 privacy cleanup을 production에 다시 배포하고 빈 출발지로 시작하는지 확인하기 전에는 운영 반영 완료로 판정하지 않는다.
- GitHub repository visibility가 현재 `public`으로 확인되지만 기존 프로젝트 문서는 `private`을 전제로 했다. 과거 Git history에는 현재 source에서 제거된 개인 기본값이 남아 있을 수 있으며, history rewrite/force push 또는 repository visibility 변경은 별도 명시적 결정 없이는 수행하지 않는다. 코드상 secret은 server-only 경계를 유지하되, source repository 공개범위 자체는 별도 명시적 결정 없이 변경하지 않는다.
- Google Places의 한국 매장 coverage가 불완전할 수 있어, 매칭되더라도 `parkingOptions`가 없으면 `확인 필요`다.
- PK6 인근 주차장 조회는 최대 15개와 500m local matching이므로 검색 영역의 모든 주차장을 보장하지 않는다.
- 실제 기기 GPS 권한 허용과 비로그인 브라우저의 화면 응답은 자동화 환경에서 직접 확인하지 않았다. GPS 거부 및 API 인증 차단은 regression fixture로 검증한다.
- 캐시는 isolate-local이므로 인스턴스 간 공유, 지속성, 전역 rate limiting을 제공하지 않는다.
- 200 km 검색도 Kakao가 반환한 최대 45개 POI 중 필터된 최대 30개만 비교하므로 전역 최적을 보장하지 않는다.
