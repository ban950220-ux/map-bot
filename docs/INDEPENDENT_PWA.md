# MAP 독립 PWA 후보 — 2026-11-05

이번 작업은 사용자가 새로 요청한 독립 웹앱/PWA 개발이다. `AI_HANDOFF.md`와 `AGENTS.md`의 “이번 인수 작업에서 제품 기능을 바꾸지 않는다”는 이전 문맥과 구분한다. 운영 보존, provider 의미, 비용·비밀정보·배포 제한은 계속 적용한다.

## 소스와 격리

- 검증된 출발점: PR #6 / `58b31997cc979bafa46efb6bd006bc96d75b43b1`.
- 별도 브랜치: `ai/codex/map-independent-pwa-20261105`.
- 원래 `/workspace/map-bot`의 `cloud/map-bootstrap-smoke` 작업 트리를 보존하고 별도 Git worktree에서 개발했다.
- 과거 `map-independent-pilot-20261105.tar.gz`는 가져오거나 검증 완료본으로 사용하지 않았다. 최신 PR #6부터 새로 구현했다.
- 기존 `app/`, `components/`, `lib/`, `services/`, `public/`, `vite.config.ts`, Sites plugin/hosting, npm lock과 Node 계약은 변경하지 않는다.
- `npm run build`는 기존 Sites `dist/`를 만든다. `npm run build:independent`는 명시적으로 선택한 소스만 `.independent-build/`에 복사하고 독립 `vite.config.ts`, Worker, 인증 adapter, 계정 UI를 적용한다. `.openai`와 `.env*`, 운영 비밀값은 복사하지 않는다. 출력은 `dist-independent/`다.
- 독립 build 전후의 Sites `dist/` 전체 파일 digest를 비교하고 변경되면 실패한다. 결과는 `dist-independent/build-isolation.json`에 남긴다.
- Sites v24 / source `5431a5778ad698d8cdb6d709a5c717419b3a8e1a`는 이번 작업으로 배포하거나 수정하지 않았다.

## 독립 인증과 PWA

독립 Worker가 모든 요청을 먼저 처리한다(`assets.run_worker_first: true`). ChatGPT/Sites ingress나 운영 인증은 변경하지 않는다. 독립 빌드 내부에서만 `getChatGPTUser` 호환 adapter를 대체하며, 인증된 독립 Worker가 넣는 내부 소유자 표시만 읽는다. 들어오는 `oai-*`, `x-map-*` 헤더는 거부한다. 원래 Sites 빌드에는 이 adapter를 적용하지 않는다.

독립 설정이 없으면 앱/API는 503으로 닫힌다. 공개 경로는 명시한 manifest, 아이콘, SW와 정적 JS/CSS/font뿐이다. 앱/API는 세션이 필요하다. POST는 정확한 same-origin `Origin`을 요구하며 cross-site 요청을 거부한다. 로그인은 PBKDF2-SHA256 100,000회 비밀번호 검증, 256-bit 임의 세션, 서버 측 session-key SHA256 저장, 최대 1시간 만료를 사용한다. 쿠키는 `__Host-`, Secure, HttpOnly, SameSite=Strict다. 로그아웃은 서버 세션 삭제, 쿠키 만료, 브라우저 storage/cache 제거를 요청한다. 후속 변경에서는 한 소유자 Durable Object authority가 로그인 시도·세션·로그아웃을 직렬화한다. 로그인 실패는 소유자 계정 단위 5회/5분으로 제한한다. KV 또는 isolate-local 인증 fallback은 없다.

manifest/아이콘은 기존 MAP 브랜드를 재사용한다. Android 및 iPhone 설치 안내를 제공하지만 설치 가능 판정을 꾸며내는 버튼은 없다. SW는 등록/활성화만 하고 fetch를 가로채거나 Cache Storage를 쓰지 않는다. 모든 독립 응답은 `no-store`다. 검색 결과·인증·위치를 오프라인 제공하지 않는다. 기존 30분 sessionStorage checkpoint 동작은 보존하며 로그아웃 시 지운다. 이는 새 offline cache가 아니다.

독립 Worker observability는 기본 비활성이다. 지도 제공자 호출 방식·4개 동시 경로 제한·부분 실패·취소·재개·CSV·Google zero-call 규칙은 기존 로직을 재사용한다.

## 로컬 실행

Node `.node-version` = 24.22.1, 기존 npm lock을 사용한다. 현재 cloud 기본 Node 24.19.0 대신 임시 경로에 24.22.1을 설치했다. 다른 환경은 표준 PATH로 같은 버전을 선택한다.

```sh
python scripts/dev.py setup
python scripts/dev.py build
python scripts/dev.py build-independent
python scripts/dev.py test-independent
# 이 cloud 이미지의 시스템 Chromium 사용 시에만 지정한다.
MAP_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium python scripts/dev.py test-independent-browser
python scripts/dev.py preview-independent
```

`preview-independent`는 테스트 전용 Miniflare Worker/SQLite Durable Object, synthetic owner와 지도 mock만 사용하며 loopback 임의 포트에서 실행한다. 주소와 PID는 ignored `.sites-runtime/independent-preview.json`에 기록한다. 터미널에 표시하는 비밀번호는 synthetic fixture일 뿐 실제 자격증명이 아니다. 이 미리보기는 CSP로 브라우저 외부 요청도 차단하고 같은 출처에서 synthetic SDK를 주입한다. 실제 서버 outbound는 fixture allowlist 밖에서 실패한다. 종료는 실행 중인 터미널에서 Ctrl+C다. 새 환경을 만들거나 외부 호스팅을 하지 않는다.

## 검증과 남은 경계

정확한 결과는 `docs/validation/map-independent-20261105.json`을 참조한다. 초기 발견한 로그인 referrer/origin 문제와 정적 asset 경로 누락은 수정했다. Miniflare gateway는 redirect를 수동 전달하므로 브라우저가 실제 303 로그인 흐름을 수행한다. Playwright 고정 browser가 이 이미지에 없어 명시적 시스템 Chromium 151 fallback을 사용했다. 고정 Playwright browser와 같은 것으로 주장하지 않는다.

현재 판정: **LOCAL CANDIDATE VALIDATED / NOT READY FOR PRODUCTION**.

아직 필요한 단계:

1. 독립 HTTPS 호스팅의 정확한 계정·대상, 무료 요금/한도와 과금 차단 상한을 확인한다. 현재 실행 환경은 Cloudflare outbound identity/배포 credential이 없으며 Cloudflare 서비스 도메인도 허용 대상에 없다. 신규 인증이나 네트워크 정책 변경은 실행하지 않았다.
2. 사용자가 지정하는 독립 소유자 인증 설정 `MAP_ORIGIN`, `MAP_OWNER_SALT`, `MAP_OWNER_PASSWORD_HASH`, 단조 증가하는 `MAP_AUTH_GENERATION`과 독립 `MAP_AUTHORITY` Durable Object binding이 필요하다. 현재 class/binding/migration 설정은 로컬 후보 코드일 뿐 원격 namespace/migration을 생성·적용하지 않았다. 실제 비밀번호/해시/키를 생성하거나 운영에서 복사하지 않았다. provider credentials도 이전하지 않았다.
3. 최초 e7f07a6 후보의 KV eventual-consistency 한계는 후속 로컬 authority 후보로 교체했다. 실제 workerd에서 복수 ingress·프로세스 재시작·로그아웃 무효화·동시 시도 제한·자격증명 세대 교체를 검증한다. 상세 보장 범위와 실제 운영 선택은 `docs/INDEPENDENT_AUTHORITY.md`에 기록한다. 원격 binding/provisioning과 실제 지역 간 지연·장애·업데이트 전파·CPU/요금 한도는 여전히 검증하지 않았다.
4. provider 연결은 별도 비용 승인과 독립 도메인 등록이 필요하다. 실제 Kakao/NAVER/Google 호출, 실제 타일, 실제 GPS는 검증하지 않았다.
5. 실제 HTTPS 응답과 Android/iPhone 설치·standalone·세션·모바일 재시작을 검증해야 한다. 로컬 manifest/icon/SW 성공을 실제 휴대폰 설치 성공으로 보고하지 않는다.
6. GitHub repository는 public, 연결 앱은 push/admin 권한을 보고하며 열린 PR은 #6이다. 실행 환경 자체에 GitHub outbound identity는 없다. 기존 workflow는 standard `ubuntu-latest`와 운영 비밀값 없는 검사지만, 외부 hooks 및 계정별 과금 조건은 이 도구 범위에서 확인되지 않았다. 비용 상한이 불명확한 실행을 일으키지 않도록 이번 후보의 원격 push/새 PR 생성은 보류하고 로컬 commit·patch·bundle 및 PR 초안을 보존한다. 이 보류는 접근 거절이 아니라 게시 전 검증 미충족이다.

## 복구와 인수

운영 복구 작업은 필요 없다. 이전 PR #6와 원래 worktree는 그대로 남아 있다. 개발만 되돌리려면 독립 브랜치의 새 commit을 revert하는 별도 PR을 준비한다. `dist/`는 원래 build로 재생성할 수 있고 `dist-independent/`, `.independent-build/`는 재생성 가능한 후보 산출물이다. 실제 운영 데이터·비밀값·일정·Sites 접근 설정은 건드리지 않았다. 번들과 patch는 base `58b3199` 이후 변경을 포함하며 최종 보고의 경로에서 같은 작업을 이어갈 수 있다.

최종 검증 보충: 최종 단독 순차 실행에서 기존 Sites 브라우저 44/44, 독립 후보 4개 흐름×3회=12/12, 인증 3/3이 통과했다. 앞선 두 suite의 동시 실행에서는 Sites 131/132, 독립 후보 10/12로 시간 초과가 있었으며, 실패한 Sites 항목도 별도 3/3 재검증했다. 동일 제품 코드·동일 timeout 설정으로 단독 실행이 통과했고 CPU throttling 관측도 있었지만, 동시 실행 자원 경합은 추정 원인으로 기록한다. 실패 기록을 숨기거나 전체 132/132로 바꾸지 않는다. 타입·lint·command contract·Sites build·독립 build·지도 mock/audit/directions 검사도 통과했다.
