# Production v20 browser acceptance baseline

## Scope and baseline

- Canonical repository: `ban950220-ux/map-bot`, branch `main`.
- Production v20 baseline commit: `41968b86a30c51e8406faf9c02fa66f83f0215ca`. The follow-up gate audit started from clean local/GitHub main `79d16967b378834e2938bd9c4fbe6f5e05bb884c`, which already contains the suite and minimal fixes; no reset was performed.
- Existing Sites project: `appgprj_6aa13e471abc819193188a4999e314f6`.
- Production: `https://my-drive-time-ban357.ban950220.chatgpt.site`; release-closure rollback point: version 20 (version 19 also retained).
- v20 live search/auth/map/PWA asset verification is the supplied, completed baseline. This suite does **not** rerun live providers or certify a new production deployment.
- Test construction found a completed-partial-search resume bug and narrow-screen long-token clipping. These fixes and named results/progress labels were explicitly deployed in version 21 on 2026-10-01 from `80e7502a3cca2bcc28cf3fadd3bf3af574096169`. GitHub push alone never deploys Sites. Subsequent documentation-only publications must also pass same-SHA CI and preserve source alignment; authoritative current version/SHA comes from Sites metadata.

## Three separate validation layers

Detailed sequence: pure unit logic → mock provider Worker regression → deterministic browser acceptance → separately authorized live provider smoke → production smoke → Android real-device acceptance. The first two are currently grouped in the existing `check-nearby.mjs` command; device acceptance cannot be inferred from any desktop layer.

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

The fake SDK accepts the real app's marker DOM and polyline coordinates and exercises selection callbacks. This proves overlay creation, selection and no-call interactions, **not** actual map tiles, NAVER SDK compatibility or geographic bounds rendering. Those stay in Layer 3. Route/POI gates control abort/fatal/race order without arbitrary sleeps. One timeout case withholds a response until the actual NAVER adapter's 18-second deadline; its 21-second assertion budget reflects that real deadline, not a flaky-test workaround. A fresh Worker per test prevents isolate-local caches from leaking between scenarios.

All fixture locations are synthetic, not device GPS or private addresses. Fake credentials are fixed nonfunctional `fixture-*` values. Tests neither read `.env`/keyring nor contact production. `/api/store-parking` has no active-flow call; one explicitly marked negative probe verifies its 410 response.

## Scenario coverage

| Scenario | Assertions |
| --- | --- |
| A | Nearby default tab; real category request; 15 routes; ETA/road/straight labels; list before map; marker/card/selected path synchronization |
| B | Direct Starbucks matches exclude nearer generic cafes from route pool and top results |
| C | Multiple origins never auto-select; keyboard choice's coordinates reach real API/upstream |
| D | Zero POI replaces previous result; empty guidance; one candidate is usable |
| E/F | 12 successes/3 failures remain visible; partial checkpoint; resume retries exactly failed IDs; no duplicates |
| G/H | Browser fetch abort; 4 completed candidates survive; late response cannot change cards, ETA, markers, selection, progress, error or checkpoint; resume sends only 11 pending candidates |
| I | 401 and 429 stop later batches, preserve successes, block immediate resume including after refresh |
| J | Separate POI and routing races; UI serializes active searches; abort A then finish B and select a card before releasing A; query/cards/ETA/markers/path/selection/progress/error/checkpoint all remain B |
| K | Edited input explicitly labels results as previous conditions and triggers no requests |
| L | Different address, x, y, query, radius, count, expand cannot reuse the old identity; x/y cases change only a coordinate, keeping location-kind constant. Identical identity explicitly permits refresh/resume with no new candidate search |
| M | Complete checkpoint refresh restores results without resume/provider calls; geometry absent; expired checkpoint ignored |
| Parking/CSV | POI vs parking intent; PK6; store parking unknown; real CSV download labels/values and no Google-derived fields |
| Additional failures | All routes fail then refresh/resume; browser network failure; actual 18-second provider timeout; SDK failure leaves comparison functional |
| Google policy | Dedicated normal/brand/parking regression cases assert zero Google host requests and zero active store-parking calls, plus exact mock operation budgets |
| WebMCP | Contract-shim registration/execution of both actual tools; schema rejection; UI/API result correspondence; no Google fields |
| Legacy | Real direct and 56 saved-store UI comparisons; expand list without new provider calls |
| Responsive | 360×800 / 390×844 / 430×932 / 768×1024 / 1200×900; overflow and internal text clipping; long names/addresses; keyboard selectors/ESC; ambiguity/error layout; list-first bounded map |
| A11y/GPS/PWA | Accessible form labels, focus, results/map regions, progress/error; synthetic GPS allowed/denied/timeout/unsupported; credentialed manifest/icons and dimensions |

Every app fixture asserts zero unexpected browser/server external requests, zero active store-parking calls, zero unexpected `console.error` and zero `pageerror`. Only two deliberate resource failures have narrow exceptions: exactly one `net::ERR_FAILED` message for the aborted SDK script or route fetch in its respective fault-injection test. No app exception is allowlisted; unused exceptions also fail.

On Windows, workerd may print native `WSARecv #64` / `WSASend #10054` socket-disconnect diagnostics during deliberately aborted requests. These were observed without failed browser assertions, are not browser console/page errors, and are not suppressed by an allowlist. Do not interpret the browser zero-error assertion as a claim that native engine stderr is always empty. Linux CI is independently required to pass.

Normal routing proves peak concurrency exactly 4 and client batches `[4,4,4,3]`; legacy also asserts no more than 4. ETA/distance/recommended sort, card/marker/fake-map movement and result expansion make no new provider requests. This is a per-comparison/request concurrency contract, not a global Worker rate limiter; an intentionally late mock response may outlive a cancelled fetch.

Real network transmissions to Kakao, NAVER and Google are all zero. Typical mock counts are geocode 1, POI 1, Directions 15 (brand 3), PK6 0 (parking 1). A browser SDK URL is intercepted and fulfilled locally, not downloaded from NAVER. These mock URL requests must not be reported as live provider calls.

The responsive reduced-height viewport approximates keyboard space but does not simulate the actual Android keyboard. A11y checks are smoke coverage, not WCAG certification or screen-reader-device validation.

## WebMCP limitation

The test installs only `document.modelContext.registerTool` as a contract shim, then executes the app's real registered callbacks through the UI/API pipeline. This suite does not test native browser/ChatGPT invocation. Native discovery of both tools was separately observed in the authenticated production Codex browser on 2026-10-01; valid-input/provider execution remains NOT RUN pending paid-use consent. Registering a legacy tool requires mounting its tab. Do not report the shim or discovery alone as full native platform E2E.

## Artifacts and CI

`test-results/` and `playwright-report/` are ignored by Git and lint. Screenshots are retained on failure only. **Raw trace/HAR capture is disabled**, because even synthetic auth cookies/headers should not enter artifacts. Do not override this with `--trace on` or point this harness at production. The failure summary uses an allowlist of operation/candidate ID/status/abort and blocked hostname; arbitrary console text is reduced to fixed error categories instead of stored. Headers, cookie values and request bodies are excluded. All screenshot-visible locations are synthetic; real credentials/GPS must never be used with this harness.

Offline CI runs on standard Ubuntu/Node 22 with no secrets and no live provider calls. Browser tests run after the build. Retries remain zero. Persistent CI artifact uploads are not enabled; this avoids unreviewed artifact retention/storage costs. Failed local runs retain screenshots and the header-free summary; CI logs include assertion diagnostics. Package/browser installation needs registry/CDN access, whereas provider execution does not.

## Manual device and publication gates

See `ANDROID_ACCEPTANCE.md`. The separately authorized existing-Site runtime update succeeded as v21; rollback v20 remains available. Production root/legacy UI and anonymous 401 boundaries were checked separately. Live provider smoke requires its own cost approval. A local build or mocked authentication test cannot mark production/PWA installation verified.

## Recorded local validation

2026-09-30 final gate audit: build, TypeScript, lint and offline workerd regression PASS. Windows Chromium / Node 24: **41 cases × 3 consecutive runs = 123 PASS**, zero retries, approximately 3.4 minutes, using `npm run test:browser:repeat`. The existing esbuild-based mock script required unsandboxed local execution because Windows sandbox denied parent-directory traversal; that run remained entirely mocked and passed. `80e7502` passed all Node 22 CI stages in [run 36712283943](https://github.com/ban950220-ux/map-bot/actions/runs/36712283943). The 2026-10-01 pre-deployment gate repeated fresh build, TypeScript, lint, offline regression and **41/41 browser PASS** (1.2 minutes). Every later source commit still requires its own CI before publication. No real provider calls are made by this suite.
