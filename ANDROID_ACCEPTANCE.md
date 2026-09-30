# Android Chromium / installed app acceptance

Status: **NOT RUN — no actual Android device was controlled for this work**.

Target: existing owner-only production `https://my-drive-time-ban357.ban950220.chatgpt.site`, version 20. Do not create a new Site or relax authentication to enable installation. Desktop manifest/synthetic GPS tests are separate evidence only.

Before a live search, check provider free quota or obtain specific approval for any separately billed API usage. Stop if cost scope is unknown. Use a public departure place for ordinary search checks. GPS is optional and must only be requested with the device owner's consent.

## Minimal manual checklist

Record each item PASS / FAIL / NOT RUN, plus device model, Android version, browser/version and date. Do **not** record location, addresses, account identifiers or credentials.

- [ ] Open production in Android Chromium and complete normal ChatGPT sign-in; owner-only access remains enforced.
- [ ] Confirm the site name and UI load; authenticated manifest and 192/512/maskable icons load without an authentication or network error.
- [ ] Open the browser menu; record whether “앱 설치” / “홈 화면에 추가” is available and the actual type offered (shortcut is not standalone proof).
- [ ] Install/add using that native browser UI; confirm the dedicated 가까운 한 끼 icon, not a generic browser icon.
- [ ] Launch from the home-screen icon; confirm standalone display (no ordinary browser address bar), correct title/icon, and usable safe area/back navigation.
- [ ] Verify login is retained or normal ChatGPT authentication returns successfully to the app. Do not infer this from the ordinary tab's login.
- [ ] Run one authorized public-place nearby search; compare ETA and road distance; confirm list before map and marker/card selection.
- [ ] Tap “현재 위치 사용”; the browser/OS permission prompt appears when permission is unset.
- [ ] With explicit consent, allow once; confirm departure updates and manual entry still works. Do not copy the coordinate text.
- [ ] Reset only this site's location permission through browser/OS site settings, deny, then try again; confirm explanatory fallback and no crash.
- [ ] Without allowing GPS, enter a public-place address and confirm normal comparison works.
- [ ] Check keyboard open/close, scrolling, one-handed search/cancel/resume and long result-card text on the real device.

Do not take screenshots, traces or logs while exact GPS is visible; use public/synthetic fixtures for shareable evidence. Clear this site's comparison session by closing its tab/standalone session after GPS testing if appropriate; do not erase unrelated browser data. Authentication clearing/uninstall is not required.

## Completion criteria and limitations

Installation, dedicated icon, standalone launch, authentication and manual/GPS fallback must each be checked on a real device before claiming Android PASS. A browser may offer only a shortcut; record that fact rather than changing the app architecture or faking an installation prompt. Native WebMCP discovery/invocation also requires its supported host, not this Android checklist's ordinary browser by assumption.
