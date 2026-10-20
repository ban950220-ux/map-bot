# MAP cloud setup and smoke runbook

MAP can be edited and tested in a Linux cloud container without a PC, provider
secrets, Windows keyring, production access or a database. This runbook does not
deploy the app. Preserve the existing Sites project and owner-only policy.

## Fresh environment

Use the saved `map-bot` environment and its repository checkout, or clone
`https://github.com/ban950220-ux/map-bot.git` into a writable directory. Select the
reviewed work branch when testing changes; do not merge it into main as setup.
Read `AGENTS.md` and any available `.agents/skills` first.

Requirements: Linux shell, Git, Node >=22.13, npm, writable checkout and `/tmp`.
Node 24 is also supported. Dependencies and browser installation require registry
and CDN access; the application tests use mocked providers. Never change firewall,
OAuth, credentials or permissions to repair a bootstrap failure automatically.

```sh
node --version
npm --version
git status --short --branch
npm run install:ci
# Re-running the same command must succeed; do not run installers concurrently.
npm run install:ci
npm run build
./node_modules/.bin/tsc --noEmit
npm run lint
node --import ./scripts/sites-env.mjs scripts/check-nearby.mjs
npm run smoke:cloud
```

Saved environment setup command: `npm run install:ci` from the repository root.
Do not use `npm ci` as the cloud setup command when HOME is not writable.
Do not make environment startup depend on API secrets, browser downloads, live
checks, an existing build directory or a running production service.

`install:ci` uses ignored `.sites-runtime/npm-cache` by default. `npm run` injects
the default `npm_config_cache`, so a conditional assignment alone cannot fix an
unwritable home cache. To choose another writable cache, set `MAP_NPM_CACHE`.
The lockfile, registry and dependency versions remain unchanged. Optional native
dependencies and development dependencies are installed explicitly.

The local runner puts Wrangler config under `.sites-runtime/config` unless
`XDG_CONFIG_HOME` was explicitly supplied. Existing runtime/log/registry overrides
remain supported. `SITES_RUNTIME_ROOT` changes the Wrangler runtime directory;
it does not change the npm or browser cache. All defaults are ignored by Git.

## Start and stop

```sh
# Development server, default port 5173:
npm run dev
# Explicit loopback IPv4/port, useful for automated container probes:
npm run dev -- --hostname 127.0.0.1 --port 5173
# Production-compatible local Worker (build first), default port 8787:
npm run start
```

Stop with Ctrl-C. Do not expose the local server publicly or weaken auth for a
preview. The existing local Sites sign-in helper and production auth are unchanged.
`localhost` can resolve to IPv6; an IPv4-only probe must start dev with the explicit
loopback hostname above. An anonymous API 401 is expected and proves the API guard
is active; it is not a startup failure or proof of a successful provider search.

`smoke:cloud` requires Linux and an existing build. It starts the actual dev/start
npm scripts sequentially on temporary IPv4 loopback ports, verifies root HTML 200
and anonymous `/api/status` 401, then stops its process groups. It rejects local
`.env*`/`.dev.vars*` files except `.env.example`, removes provider credential
variables from child processes and does not print server output or response bodies.
Use a clean checkout for this check; never delete a user's secret files to run it.
On failure, run the named dev/start command locally to diagnose the tool error.

## Offline browser acceptance

```sh
npm run cloud:browser -- install chromium
# Build before testing to avoid stale output:
npm run build
npm run cloud:browser -- test
# Required when changing the browser suite/configuration:
npm run cloud:browser -- test --repeat-each=3
```

`cloud:browser` shares a writable `.sites-runtime/browsers` directory between
download and execution. `PLAYWRIGHT_BROWSERS_PATH` can explicitly override it.
Do not mix this installer with bare `npx playwright test` using a different cache.
The existing GitHub CI continues to use its own pinned browser installation.

If the CDN is denied but the image already includes Chromium, an explicit fallback
is available without downloading another browser or changing network policy:

```sh
command -v chromium
chromium --version
MAP_CHROMIUM_EXECUTABLE_PATH="$(command -v chromium)" npm run cloud:browser -- test --repeat-each=3
```

Record the browser version. This is not verification of the Playwright-pinned
browser. If neither binary nor required OS libraries are available, report the
browser gate as blocked; do not request elevated installation automatically.
Tests keep zero retries, loopback-only mock upstream, synthetic data, no raw
trace/HAR and existing failure-artifact rules. See `BROWSER_ACCEPTANCE.md`.

## Variables and validation boundaries

No provider variable is required for install/build/start or offline tests.

| Variable | Purpose for separately authorized live operation |
| --- | --- |
| `NAVER_MAPS_CLIENT_ID` | NAVER API identity; public SDK ID is the only client-visible credential field |
| `NAVER_MAPS_CLIENT_SECRET` | Server-only NAVER Geocoding/Directions authentication |
| `KAKAO_REST_API_KEY` | Server-only Kakao Local place search |

Do not print or paste their values. Live helper scripts use Windows keyring and
are not part of this cloud workflow. Google is inactive in the application flow.
Real searches, map tiles, native WebMCP, production login and Android installation
remain separate gates; offline PASS must not be presented as their validation.

## Failure classification

| Evidence | Classification / next step |
| --- | --- |
| Environment never becomes ready, no shell/checkout tool | Platform blocker; no repository checks ran |
| npm ENOENT/EACCES for home `_cacache` | Bootstrap cache-path issue; use `install:ci` |
| Wrangler mkdir error for home `.config/.wrangler` | Bootstrap tool-state issue; use the preloaded local runner |
| Registry/CDN DNS, timeout, 403 `Domain forbidden` | Network/platform dependency availability, not an app assertion failure |
| Browser executable missing | Browser installation gate blocked; explicit installed-browser fallback if available |
| Build/type/lint failure or mock assertion failure after successful setup | Repository validation failure; retain command and exit status |
| Root 200 and anonymous API 401 | Fresh local startup PASS only |
| Mock Worker/browser assertions pass | Offline application functionality PASS only |

## 2026-10-10 cloud validation

The saved environment became ready with shell and checkout at base `f60c702`.
Node 24.19.0 / npm 11.9.0. Workspace-level `.agents`/`.codex` were empty and the
repository had no `.agents/skills`; repository `AGENTS.md` was applied.

Initial `install:ci` failed with home-cache ENOENT; the fixed command installed
679 packages and passed on repeat. Initial built `start` failed creating home
`.config/.wrangler`; project-local XDG config addresses that separate failure.
The registry was reachable. Playwright Chromium 153 / build 1243 download returned
403 `Domain forbidden`; the image's Chromium 151.0.7922.173 was used explicitly.

Final results on work branch `cloud/map-bootstrap-smoke`:

| Gate | Result |
| --- | --- |
| Fresh cloud shell and platform-provided Git checkout | PASS |
| Fixed install and repeat install | PASS, 679 packages |
| Build / TypeScript / lint / offline workerd regression | PASS |
| Secret-free dev and built Worker smoke | PASS: each root 200, anonymous API 401 |
| Browser mock suite, installed Chromium 151 | 123/123 PASS (41 × 3), zero retries, 4.1 min |
| Separate clean Git clone of code commit `dcda354` | PASS: fresh install, build, typecheck, lint, offline regression and dev/start smoke |
| Playwright-pinned Chromium 153 download and execution | BLOCKED by CDN 403; not certified by fallback results |
| Live providers / production / native WebMCP / Android | NOT RUN |

The clean clone had its own initially empty dependency and tool-cache directories.
No dependency versions, application runtime, provider policy, auth, hosted project,
database or network security settings changed. Changes were committed locally on
the work branch; no main merge or deployment was performed. The platform's saved
environment settings were not edited through this checkout; use the setup command
above when configuring that environment. Success here does not diagnose BANSIGHT
or guarantee that the platform can never fail before exposing a shell.

## 2026-10-19 current-main integration check

The bootstrap branch was merged into a separate checkout of `main` at
`5431a5778ad698d8cdb6d709a5c717419b3a8e1a` for validation. There were
no merge conflicts. Starting without `node_modules`, `npm run install:ci`
installed 679 packages and passed again on a second run. Build, TypeScript,
lint, offline workerd regression, audit regressions and NAVER directions URL
fixtures passed. The secret-free dev and built Worker smoke each returned root
200 and anonymous API 401. With the image's explicitly selected Chromium
151.0.7922.173, the current 44-case browser suite passed three times with no
retries (132/132). This browser run did not use a live provider.

These checks prove the merged source works after an explicit checkout and
setup in this container. They do not prove that the platform's saved
environment selects the reviewed source ref or runs `npm run install:ci`
automatically on a new start. That saved configuration was not changed or
exposed by this repository workflow. Verify it through the platform's
environment settings and a subsequent fresh automatic start before marking
automatic bootstrap complete. No production Site publication is needed to
validate this development-environment behavior.
