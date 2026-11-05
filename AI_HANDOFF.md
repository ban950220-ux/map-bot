# MAP AI handoff — 2026-11-05

## Confirmed source

- GitHub: https://github.com/ban950220-ux/map-bot ; default `main`. Inspected source SHA `f3264382d0ef8cf5be2759b1f16bccc3aabff1eb`.
- Development branch: `ai/codex/portable-development-20261105`; PR base `main`. Preserve `checkpoint/ai-source-20261105`.
- Production version/source are separately recorded in `docs/source-provenance.json`. A GitHub merge is not a deployment.
- Existing open PRs: none

## Commands and environment

Python 3.12+ is used only for the stdlib command driver. JS projects use `.node-version` and the existing npm lock. Account Bot's canonical Linux Python constraint set is separately sourced from a successful CI job; other OS/runtime matrix entries are compatibility checks, not a fully hashed lock. Install requires package registry access or an adequate local cache.

| Task | Command |
|---|---|
| setup | `python scripts/dev.py setup` |
| dev | `python scripts/dev.py dev` |
| check | `python scripts/dev.py check` |
| lint | `python scripts/dev.py lint` |
| build | `python scripts/dev.py build` |
| test-unit | `python scripts/dev.py test-unit` |
| test-integration | `python scripts/dev.py test-integration` |
| test-browser | `python scripts/dev.py test-browser` |
| test | `python scripts/dev.py test` |

`setup-web` precedes Account Bot `dev`, `test` and `build-web`. `dev` opens only the private reference frontend, not the Telegram operating process. Account Bot has no configured Python static type checker; `check` compiles syntax only. MAP browser testing needs Chromium and documented system dependencies. No test command may start a live provider or send a report.

## Completed / pending

Completed in this change: source provenance, preserved source ref, shared rules, thin AI entry files, executable command vectors, deployment/rollback guide and credential-free validation contract. Actual validation outcomes belong in `docs/validation/portability-20261105.json`; historical CI success is not substituted for this change's tests.

Pending: green checks on the final PR head; external deployment hook verification; genuinely separate Claude/Gemini/Copilot/Cursor execution. A fresh directory check is not actual cross-AI acceptance.

## Product boundaries and known issues

- 런타임·지도 제공자·CSV·인증·데이터·운영 기능은 이번 작업에서 변경하지 않는다.
- 실제 Android 설치와 운영 provider 연동은 기존 확인과 새 검증을 구분한다.

Sites v24 source 5431a5778ad698d8cdb6d709a5c717419b3a8e1a is four GitHub commits behind the inspected main. The 10 changed paths are cloud development/CI/tooling files; this task does not publish them. Existing PlaceProvider and RoutingProvider interfaces already separate providers; no functional rewrite is needed.

## Approval gates

Merge into default, operating deployment, operating data changes/migrations, actual financial actions, schedule/automatic delivery activation, paid infrastructure/API and secret rotation require separate approval. Private repository branch protection is unavailable under the inspected GitHub plan (HTTP 403); these documents and CI do not enforce server-side protection. MAP public repository has no inspected rulesets. Do not change visibility or buy a plan silently.

## Subsequent isolated PWA development

The product-freeze statements above describe the earlier AI handoff task. A later explicit user request authorizes a separate independent MAP/PWA candidate while preserving operating Sites authentication/data/provider boundaries. See `docs/INDEPENDENT_PWA.md`, `docs/validation/map-independent-20261105.json` and the new independent commands in `development.json`. These local candidate results are not a deployment or a modification of PR #6.
