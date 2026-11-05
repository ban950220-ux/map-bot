# Add an isolated MAP independent owner/PWA candidate

MAP currently depends on the Sites authentication boundary. This change adds a separate build candidate with an owner session Worker, public installation assets, network-only SW, login/logout controls and mobile installation guidance. The existing Sites source and build path, provider behavior, CSV and user data remain preserved.

The independent build stages source in a separate directory, substitutes only the candidate authentication/UI adapters, and verifies that the original Sites output digest remains unchanged. Synthetic Miniflare/Chromium tests cover login/logout/replay, forged headers, origins, manifest/icons, SW/cache, search/CSV, mobile widths and cancellation/retry. See `docs/validation/map-independent-20261105.json` for final outcomes and `docs/INDEPENDENT_PWA.md` for the precise setup and limitations.

This is a local development candidate. No operating deployment, live provider requests, new production credentials or actual device installation occurred. Production session consistency, authentication provisioning, free hosting/cost bounds and physical device validation remain gates. This draft is prepared locally; no new GitHub PR has been opened.

Proposed stacked base: `ai/codex/portable-development-20261105` (PR #6), head `ai/codex/map-independent-pwa-20261105`. Do not merge into main or deploy without the separate user approval required by repository rules.
