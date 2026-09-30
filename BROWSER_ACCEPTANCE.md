# Production v20 browser acceptance baseline

## Scope and baseline

- Canonical repository: `ban950220-ux/map-bot`, branch `main`.
- Production v20 baseline commit: `41968b86a30c51e8406faf9c02fa66f83f0215ca` (GitHub main and local HEAD verified at task start).
- Existing Sites project: `appgprj_6aa13e471abc819193188a4999e314f6`.
- Production: `https://my-drive-time-ban357.ban950220.chatgpt.site`; rollback point: version 19.
- v20 live search/auth/map/PWA asset verification is the supplied, completed baseline. This suite does **not** rerun live providers or certify a new production deployment.
- Test construction found a completed-partial-search resume bug and narrow-screen long-token clipping. The minimal fixes are in main after the baseline, not automatically deployed to Sites. Named results/progress accessibility labels are also added.

## Three separate validation layers

| Layer | Command / method | Network and credentials |
| --- | --- | --- |
| 1: unit + mock Worker regression | `node scripts/check-nearby.mjs` | Fake provider responses only; dormant Google helper fixtures do not enable the active Google flow |
| 2: browser + real app/API + mock upstream | `npm run test:browser` | Local loopback only; no production secrets, keyring, provider availability or API charge |
| 3: live provider / production smoke | separately authorized `node scripts/check-nearby.mjs --live` and limited authenticated production checks | Real provider quota/cost; never part of CI; explicit paid-use approval when applicable |

## Installation and commands

```sh
npm ci
npx playwright install chromium
npm run test:browser
npm run test:browser:repeat
```

Node 22.13+ is supported. Linux CI installs browser OS libraries using `npx playwright install --with-deps chromium`. The two npm test commands rebuild the app first to avoid testing stale dist files. For focused iteration after a build: `npx playwright test --grep "E/F"`. The repeat command runs every case three times with **zero retries**, one worker, isolated Worker/browser state and ephemeral loopback ports.

Playwright 1.63.0 is an exact-pinned development dependency; only its test/runner/core packages were added. It does not enter the application client bundle. Existing Miniflare/workerd runs the built Vinext Worker. Maintain the browser binary alongside Playwright upgrades; CI pays a browser download/setup time cost, not a production bundle cost.

## Harness and safety boundary

`tests/browser/harness.mjs` serves `dist/client` and the real `dist/server/index.js` Worker. A loopback-only test gateway models the Sites trusted-header contract: a synthetic owner cookie becomes synthetic trusted headers; incoming `oai-*` headers are stripped. Anonymous API requests exercise the real authorization helper. This is **not** production login verification or an application auth bypass. No test switch is shipped in runtime source.

Miniflare's `outboundService` handles NAVER Geocoding, Kakao Local/category/PK6 and individual NAVER Directions 5 requests. It never forwards a request to the Internet. Unknown upstreams (including Google) are counted, blocked and fail the test. Browser routing independently blocks all external traffic; the NAVER SDK script is fulfilled with a small contract fake. App components, event handlers, API routes, Zod, ranking, cache and client state are real.

The fake SDK accepts the real app's marker DOM and polyline coordinates and exercises selection callbacks. This proves overlay creation, selection and no-call interactions, **not** actual map tiles, NAVER SDK compatibility or geographic bounds rendering. Those stay in Layer 3. Timed route/POI gates control abort/fatal/race order without long sleeps. A fresh Worker per test prevents isolate-local caches from leaking between scenarios.

All fixture locations are synthetic, not device GPS or private addresses. Fake credentials are fixed nonfunctional `fixture-*` values. Tests neither read `.env`/keyring nor contact production. `/api/store-parking` has no active-flow call; one explicitly marked negative probe verifies its 410 response.

## Scenario coverage

| Scenario | Assertions |
| --- | --- |
| A | Nearby default tab; real category request; 15 routes; ETA/road/straight labels; list before map; marker/card/selected path synchronization |
| B | Direct Starbucks matches exclude nearer generic cafes from route pool and top results |
| C | Multiple origins never auto-select; keyboard choice's coordinates reach real API/upstream |
| D | Zero POI replaces previous result; empty guidance; one candidate is usable |
| E/F | 12 successes/3 failures remain visible; partial checkpoint; resume retries exactly failed IDs; no duplicates |
| G/H | Browser fetch abort; 4 completed candidates/checkpoint survive; resume sends only 11 pending candidates |
| I | 401 and 429 stop later batches, preserve successes, block immediate resume including after refresh |
| J | A's upstream response is gated; UI serializes active searches; abort A then finish B before releasing A; B and checkpoint remain unchanged |
| K | Edited input explicitly labels results as previous conditions and triggers no requests |
| L | Different origin/radius/count/expand checkpoint input cannot reuse the old identity; fresh candidate search and route set required |
| M | Complete checkpoint refresh restores results without resume/provider calls; geometry absent; expired checkpoint ignored |
| Parking/CSV | POI vs parking intent; PK6; store parking unknown; real CSV download labels/values and no Google-derived fields |
| Additional failures | All routes fail then refresh/resume; browser network failure; SDK failure leaves comparison functional |
| WebMCP | Contract-shim registration/execution of both actual tools; schema rejection; UI/API result correspondence; no Google fields |
| Legacy | Real direct and 56 saved-store UI comparisons; expand list without new provider calls |
| Responsive | 360/390/430/768/1200px; overflow and internal text clipping; long names/addresses; keyboard selectors/ESC; ambiguity/error layout; list-first bounded map |
| A11y/GPS/PWA | Accessible form labels, focus, results/map regions, progress/error; synthetic GPS allowed/denied/timeout/unsupported; credentialed manifest/icons and dimensions |

Every app fixture asserts zero unexpected browser/server external requests, zero active store-parking calls and zero uncaught browser errors. Normal routing proves peak concurrency exactly 4 and client batches `[4,4,4,3]`; legacy also asserts no more than 4. Sort/card/marker/fake-map movement/result expansion make no new provider requests. This is a per-comparison/request concurrency contract, not a global Worker rate limiter.

The responsive reduced-height viewport approximates keyboard space but does not simulate the actual Android keyboard. A11y checks are smoke coverage, not WCAG certification or screen-reader-device validation.

## WebMCP limitation

The test installs only `document.modelContext.registerTool` as a contract shim, then executes the app's real registered callbacks through the UI/API pipeline. Native browser/ChatGPT tool discovery and invocation are **NOT RUN — environment limitation**. Registering a legacy tool requires mounting its tab. Do not report the shim as native platform E2E.

## Artifacts and CI

`test-results/` and `playwright-report/` are ignored by Git and lint. Screenshots and traces are retained on failure only. A safe summary contains only operation/candidate ID/status/abort, blocked host/path and fixture error messages, not request headers or bodies. Traces necessarily contain the **synthetic** test cookie/coordinates; real credentials/GPS must never be used with this harness. Do not point it at production.

Offline CI runs on standard Ubuntu/Node 22 with no secrets and no live provider calls. Browser tests run after the build. Retries remain zero. Persistent CI artifact uploads are not enabled; this avoids unreviewed artifact retention/storage costs. Failed local runs retain screenshot/trace for inspection; CI logs include assertion diagnostics. Package/browser installation needs registry/CDN access, whereas provider execution does not.

## Manual device and publication gates

See `ANDROID_ACCEPTANCE.md`. Production remains v20 until a separately approved existing-Site update. A local build or mocked authentication test cannot mark production/PWA installation verified.

## Recorded local validation

2026-09-30: build, TypeScript, lint and offline workerd regression PASS. Windows Chromium / Node 24: 32 cases × 3 consecutive runs = 96 PASS, zero retries, approximately 2.2 minutes. The existing esbuild-based mock script required an unsandboxed local rerun because Windows sandbox denied parent-directory traversal; that rerun remained entirely mocked and passed. Node 22 clean-install execution is the separate GitHub Offline CI gate.
