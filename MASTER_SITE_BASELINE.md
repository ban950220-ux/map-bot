# MASTER SITE BASELINE

이 문서는 앞으로 개발·수정하는 사용자-facing 웹사이트의 공통 기본 규칙이다.

프로젝트별 최신 명시적 요구사항과 실제 repository 규칙이 이 문서보다 우선한다. 각 프로젝트는 이 baseline을 그대로 복제해 독립적으로 변형하기보다, `AGENTS.md` 또는 `PROJECT_CONTEXT.md`에서 적용 사실과 프로젝트별 예외만 기록한다.

## 1. 기본 제품 원칙

특별한 이유가 없는 한 모든 사용자-facing 사이트는 다음을 기본 지원한다.

- 모바일 우선 responsive UI
- 데스크톱 정상 사용
- HTTPS production
- 설치 가능한 Web App / PWA
- 기존 Site/project 재사용
- server-only secret 관리
- 변경 범위에 맞는 validation
- production smoke test
- 기존 인증·데이터·핵심 기능 보존
- 불필요한 architecture 변경 금지

기존 프로젝트는 현재 구현과 배포 구조를 먼저 확인하고 최소 변경을 우선한다.

## 2. PWA / Installable Web App 기본 규칙

사용자-facing 사이트는 Android Chromium 계열에서 일반 URL shortcut이 아니라 실제 설치 가능한 Web App으로 인식되는 것을 목표로 한다.

최소 manifest 요구사항:

- `name`
- `short_name`
- 명시적인 `id`
- `start_url`
- `scope`
- `display: "standalone"`
- 필요 시 `display_override`
- `theme_color`
- `background_color`
- 192×192 standard icon
- 512×512 standard icon
- 가능하면 별도 512×512 maskable icon

특별한 routing 요구가 없다면 기본값은 다음을 우선 검토한다.

- `start_url: "/"`
- `scope: "/"`

각 프로젝트는 고유 이름·아이콘·브랜딩을 사용한다. 다른 프로젝트의 branding을 복사하지 않는다.

## 3. 정적 설정만으로 PWA 완료 판정 금지

다음만 확인하고 설치형 PWA라고 판정하지 않는다.

- manifest 파일이 존재함
- `<link rel="manifest">`가 source에 있음
- icon 파일이 repository에 있음
- `display: standalone` 설정이 있음
- build/lint가 성공함

반드시 실제 production response를 기준으로 확인한다.

최소 확인 항목:

- production HTML이 올바른 manifest를 참조하는가
- manifest URL이 HTTP 200인가
- manifest가 인증 HTML이나 다른 페이지로 redirect되지 않는가
- 올바른 JSON과 Content-Type을 반환하는가
- manifest의 `name`, `short_name`, `id`, `start_url`, `scope`, `display`, colors, icons가 browser에서 실제 parsing되는가
- 각 install icon URL이 production에서 HTTP 200인가
- 실제 이미지 크기와 MIME type이 manifest 선언과 일치하는가
- HTTPS인가
- `start_url`과 인증 flow가 scope를 깨뜨리지 않는가

회색 generic icon, 사이트 첫 글자 기반 icon 등 의도하지 않은 fallback icon이 설치 UI에 나타나면 icon 검증 실패로 취급한다.

## 4. 실제 브라우저 installability가 최종 기준

Android Chromium 계열에서 다음 중 실제 PWA 설치 흐름이 확인되어야 한다.

- browser menu에서 `앱 설치` 또는 이에 준하는 Web App 설치 항목 제공
- 지원 환경에서 실제 install prompt 제공

단순 `바로가기 만들기`만 제공되는 상태는 PWA 설치 완료로 인정하지 않는다.

설치 후 최소 확인:

1. 프로젝트 전용 앱 아이콘 생성
2. 홈 화면 아이콘으로 실행
3. 주소창 없는 standalone window 실행
4. 기존 authentication 정상
5. 핵심 기능 정상
6. navigation이 불필요하게 scope 밖으로 이탈하지 않음

실제 Android 기기 또는 동등하게 신뢰 가능한 브라우저 환경에서 설치와 standalone 실행을 확인하지 못했다면 `READY AS INSTALLABLE WEB APP`이라고 판정하지 않는다.

이 경우 최대 판정은:

`READY FOR ANDROID DEVICE VERIFICATION`

이다.

## 5. `beforeinstallprompt` / 설치 UI

`beforeinstallprompt`는 지원되는 Chromium 환경에서 installability 진단 및 custom install button 연동에 활용할 수 있다.

하지만 비표준·환경 의존 이벤트이므로 이 이벤트가 발생하지 않는다는 이유만으로 모든 PWA를 실패로 단정하지 않는다. 최종 기준은 실제 browser installability다.

custom install UI를 제공하는 경우 상태를 구분한다.

- `INSTALLABLE`: 실제 browser install prompt 실행 가능
- `INSTALLED`: 이미 standalone/설치 상태
- `NOT_INSTALLABLE`: 가짜 prompt를 띄우지 않고 실제 원인 또는 browser menu 안내

가능한 경우 `appinstalled`와 `window.matchMedia('(display-mode: standalone)')` 등을 사용해 설치/standalone 상태를 갱신한다.

단순히 “홈 화면에 바로가기 추가” 안내를 보여주는 버튼은 PWA install button으로 간주하지 않는다.

## 6. Service Worker 정책

Service Worker 부재를 installability 실패 원인으로 자동 단정하지 않는다. 최신 Chromium 계열에서 Service Worker는 모든 설치 가능 Web App의 절대 필수조건이 아니다.

Service Worker는 실제 필요성이 확인될 때만 최소 구현한다.

추가하거나 유지하는 경우:

- 정상 registration / activation / update
- 올바른 scope
- 기존 network/auth 요청을 방해하지 않음
- 민감한 API response, 인증정보, 개인 금융/계좌/portfolio 데이터를 부적절하게 Cache Storage에 저장하지 않음
- stale HTML/JS 때문에 새 production version 반영이 지연되지 않음

오프라인 기능 요구가 없다면 aggressive caching과 offline-first architecture를 기본 도입하지 않는다.

## 7. 모바일 품질

최소 다음 viewport를 고려한다.

- 360px
- 390px
- 430px
- tablet
- desktop

기본 요구사항:

- horizontal overflow 없음
- 주요 touch target 약 44px 이상
- 긴 텍스트 wrapping
- form/modal/dropdown 조작 가능
- fixed/sticky UI가 핵심 콘텐츠를 가리지 않음
- 모바일에서 핵심 기능 사용 가능

## 8. Production 업데이트 원칙

사용자가 production 반영을 요구한 작업은 기본적으로 다음 흐름으로 완료한다.

`Inspect → Implement → Validate → 기존 Site 재배포 → production smoke test`

새 Site를 임의 생성하지 않는다.

가능한 한 기존:

- production URL
- project ID
- 인증 범위
- owner-only/private 설정

을 유지한다.

코드 변경 없이 설정만 고치면 되는 문제라면 불필요한 commit/refactor를 만들지 않는다.

## 9. Secret / 인증

API key, Client Secret, token, cookie 등 비밀은:

- repository commit 금지
- client bundle 노출 금지
- manifest 포함 금지
- README/문서 실제 값 기록 금지
- log/response 출력 금지

`.env.example`에는 이름과 빈 값만 둔다.

기존 owner-only/private/authenticated 사이트는 기능 편의를 위해 인증을 완화하지 않는다. 설치 앱의 `start_url`과 authentication redirect도 동일 origin/scope에서 정상적으로 작동해야 한다.

## 10. External API / graceful degradation

외부 provider는 역할과 provenance를 명확히 한다.

가능한 경우:

- timeout
- bounded concurrency
- 오류 분류
- partial success
- graceful fallback

을 적용한다.

provider가 제공하지 않은 데이터를 추정해 사실처럼 표시하지 않는다. `unknown`과 `false`를 구분한다.

## 11. Validation

현재 프로젝트의 공식 명령과 기존 tests를 우선한다.

변경 범위에 따라 가능한 경우:

- build
- typecheck
- lint
- regression/tests
- production runtime 검증

을 수행한다.

실행하지 못한 항목은 `NOT VERIFIED`로 기록한다. source/static inspection을 실제 device/browser 검증으로 과장하지 않는다.

## 12. PWA production 진단 순서

PWA 설치 문제가 있으면 다음 순서로 진단한다.

1. production HTML의 manifest link
2. manifest HTTP status / redirect / Content-Type / body
3. manifest field parsing
4. 192/512/maskable icon production response와 실제 규격
5. `start_url`, `scope`, 인증 redirect
6. HTTPS / caching headers
7. Service Worker가 존재한다면 registration, activation, scope, update
8. Chromium installability 오류
9. `beforeinstallprompt` 지원 환경에서 event 발생 여부
10. 실제 Android의 `앱 설치` 흐름
11. 설치 후 standalone 실행

Service Worker를 먼저 추가해서 문제를 가리는 방식보다 production manifest/icon/start_url 문제를 먼저 배제한다.

## 13. 완료 판정

일반 production 변경은 검증 완료 시:

`READY FOR NORMAL USE`

PWA 작업은 실제 설치 및 standalone 실행까지 검증된 경우에만:

`READY AS INSTALLABLE WEB APP`

실제 Android 설치 검증만 남은 경우:

`READY FOR ANDROID DEVICE VERIFICATION`

실사용 blocker가 남으면:

`NOT READY — blockers remain`

으로 판정한다.

## 14. 새 프로젝트 적용

새 사용자-facing 사이트를 시작할 때 특별한 반대 요구가 없다면 이 baseline을 기본 적용한다.

특히 항상 검토한다.

- mobile responsiveness
- production-grade PWA/installability
- project-specific icon/branding
- secure secrets
- authentication
- existing Site reuse
- validation
- production deployment
- 실제 browser/device 검증 수준에 맞는 정직한 최종 판정
