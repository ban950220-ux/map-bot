# PROJECT_CONTEXT — 가까운 한 끼 지도사이트

## 목적과 현재 상태

- 개인용 주변 장소 탐색·자동차 경로 비교 사이트다.
- 출발지 또는 GPS에서 Kakao Local로 후보를 찾고, NAVER Geocoding·Directions 5로 실제 도로 거리와 교통 반영 시간을 계산한다.
- 2026-09-10 기준 최대 200 km 검색, 최대 30개 후보, 최대 4개 경로 동시 요청, 시간·거리·추천 정렬을 지원한다.
- 기존 단일 목적지/저장된 양꼬치 56곳 비교는 `LegacyRoutes`로 유지한다.
- Git 작업 트리는 이 문서 작성 전 깨끗했다. 최근 커밋은 `d393d88`, `42c32fd`, `e60548e`, `8d6f79a`이며, 검색 반경 확대·주변 탐색·Worker 리다이렉트·최초 비공개 사이트 구현 순이다.

## 기술 구조

- 런타임: Node.js 22+, TypeScript, React 19, Next 16 호환 Vinext, Cloudflare Worker, OpenAI Sites.
- UI: `app/page.tsx`, `components/NearbyExplorer.tsx`, `components/NearbyMap.tsx`, `components/LegacyRoutes.tsx`.
- API: `app/api/{geocode,places,nearby-routes,compare,status}/route.ts`.
- 지도 서비스: `services/maps/`의 입력 스키마, 장소 검색, 경로 계산, 순위, TTL 캐시.
- 공통 연동: `lib/naver.ts`, `lib/api.ts`, `lib/nearby-client.ts`.
- 인증: `app/chatgpt-auth.ts`와 API의 `authorize()`가 ChatGPT 사용자 헤더를 검사한다.
- WebMCP: `lib/nearby-webmcp.ts`가 `compare_nearby_places` 도구를 등록한다. 일반 UI와 같은 조회 흐름을 사용한다.

## 데이터와 외부 서비스

- `lib/stores.json`: 2026-08-17 기준 저장 매장 목록.
- `db/schema.ts`: 의도적으로 비어 있다. 현재 D1/R2를 쓰지 않으며 `.openai/hosting.json`도 `d1 = null`, `r2 = null`이다.
- Kakao Local API는 후보 검색, NAVER Maps는 주소 변환·자동차 경로·지도 SDK에 사용한다.
- 운영 비밀은 `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET`, `KAKAO_REST_API_KEY`다. 값은 소스·문서·로그·브라우저 저장소에 넣지 않는다.
- 브라우저에는 지도 SDK에 필요한 공개 Client ID 외의 비밀을 전달하지 않는다.

## 순위와 실패 의미

- 추천 점수는 `services/maps/ranking.ts`의 시간 0.8 + 도로거리 0.2 정규화다. 평점·리뷰·영업 여부는 공급자가 검증해 주지 않으므로 추정하지 않는다.
- 직선거리는 후보 필터용이고 최종 거리순은 도로 이동거리다.
- 일부 경로 실패·중단은 완전한 순위로 표시하지 않는다. 인증 실패, 지도 SDK 실패, 장소 검색 실패, 경로 실패를 섞어 단정하지 않는다.
- Directions 5는 1×N 행렬 API가 아니므로 제한 병렬 호출을 유지한다.

## AI 프롬프트 구조

- 사이트 자체는 OpenAI/Anthropic LLM을 호출하지 않는다.
- AI 연동은 브라우저의 WebMCP 도구 선언뿐이며, 입력은 Zod 스키마로 검증한다.
- 과거 작업 맥락에서 요구된 핵심은 `출발지 → 여러 POI 후보 → 각 후보의 실시간 자동차 ETA → Top N 정렬`이다. 현재 구현이 이 구조를 반영한다.

## 변경·검증 경계

- 일반 검증: `npm run build`, `npx tsc --noEmit`.
- 오프라인 주변 검색 회귀: `node scripts/check-nearby.mjs`.
- `--live` 검증은 실제 API 사용량과 비밀 접근이 발생하므로 사용자가 명시할 때만 실행한다.
- `.openai/hosting.json`의 `project_id`와 기존 비공개 접근 범위를 보존한다.
- 문서·Codex 설정만 바꿀 때는 사이트를 빌드하거나 배포하지 않는다. 제품 소스가 바뀐 경우에만 Sites 절차로 검증하고, 배포는 요청 범위와 접근 수준을 확인한다.

## 알려진 후속 점검

- 지도 전용 오류가 남아 있는지는 실제 화면/운영 로그를 별도로 확인해야 한다.
- DB가 실제로 필요해질 때만 Drizzle 스키마와 D1 마이그레이션을 추가한다.
- 추천 점수에 새 속성을 넣을 때는 공급자 출처·결측 처리·정규화·UI 설명을 함께 변경한다.
