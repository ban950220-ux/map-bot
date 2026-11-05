# MAP 독립 인증 authority 후속 검증

기준은 e7f07a6ecf99e286587ee9413f4a6a11402b6200이다. 같은 worktree와 ai/codex/map-independent-pwa-20261105 브랜치에서 계속한다. 기존 Sites auth, 운영 데이터, provider 코드와 빌드는 변경하지 않는다.

## 발견한 한계

기존 후보는 세션을 isolate 메모리가 아니라 Cloudflare KV에 저장했다. 따라서 isolate 하나가 사라져도 KV 데이터는 남지만, eventual-consistency replica가 삭제 전 세션을 읽을 수 있었다. 로그인 실패 횟수의 read/modify/write도 원자적이지 않아 동시 요청에서 유실될 수 있었다. 비밀번호 hash/salt 변경 후 기존 세션을 일괄 무효화하는 generation도 없었다. 실행 환경을 바꾸는 것으로 해결되지 않는다.

## 새 로컬 코드

`OwnerAuthority`는 한 namespace의 고정 이름 `map-owner-v1` 객체에 소유자 상태를 모은다. 모든 독립 ingress Worker가 같은 binding/객체를 사용한다. 매 API 요청에 authority를 확인하며, ingress/브라우저에 긍정 인증 결과를 캐시하지 않는다. 기존 KV 인증 fallback을 제거했다.

권위 상태는 세션 token의 SHA256, 절대 만료시간, 실패 횟수, 자격증명 fingerprint와 generation만 저장한다. 원문 token·비밀번호는 저장하지 않는다. 세션은 최대 16개로 제한하며 초과 시 가장 오래된 세션이 제외된다. SQLite-backed Durable Object storage의 한 record를 원자적으로 저장하고, WebCrypto await 구간을 포함해 `blockConcurrencyWhile`로 전체 인증 연산을 직렬화한다. 이는 로컬 Miniflare에서만 자원을 만들었으며, 원격 namespace/DB/KV/migration이나 OAuth/credential을 생성하지 않았다.

| 상황 | 동작 |
| --- | --- |
| 저장된 세션이 존재하고 만료 전 | 내부 소유자 표시를 넣어 기존 지도 API에 위임 |
| 세션 없음/만료/로그아웃 후 재사용 | API 401, 화면은 로그인 303 |
| authority/binding/저장소 오류, 깨진 상태 | 503, 기존 지도 handler에 위임하지 않음 |
| 로그아웃 저장 실패 | 503, 성공 redirect·쿠키 삭제를 보내지 않음. 복구 후 재시도 필요 |
| 5분 내 허용된 실패 5회 이후 | 전 ingress에서 429; 재시작해도 budget 유지 |
| 같은 generation에서 hash/salt만 변경 | 503으로 닫힘; 조용히 기존 세션을 인정하지 않음 |
| 더 큰 generation의 설정이 authority에 저장됨 | 기존 세션 모두 폐기, 낮은 generation 요청/rollback은 503 |

자격증명 교체는 새 hash/salt와 함께 `MAP_AUTH_GENERATION`을 증가시키는 방식이다. opaque token 구조라 별도 JWT 서명키는 없다. 여기서 ‘키 교체’ 모델은 소유자 검증 자격증명의 교체를 뜻하며 실제 secret을 생성·회전한 것이 아니다. rollback도 generation을 내리지 않고 새 generation으로 올린다. namespace와 고정 객체 이름을 유지해야 monotonic 기록을 이어갈 수 있다. 상태 복원/namespace 교체는 별도 인증 운영 결정이며, 오래된 snapshot으로부터의 세션 부활 방지를 다시 설계해야 한다.

보장의 기준점은 authority에서 logout/rotation이 durable commit된 시점이다. 그 이후 시작한 인증 확인은 폐기된 세션을 거부한다. 이미 인증된 진행 중 지도 요청을 원격으로 취소하는 보장은 없다. 실제 배포의 Worker/DO code 및 설정 전파 동안 이전 authority가 계속 작동할 수 있으므로 설정 배포 버튼을 누른 순간부터 전 세계에서 즉시 변경된다고 주장하지 않는다. 서로 다른 generation이 일시 공존하면 새 Worker는 준비되지 않은 authority에 대해 503을 받을 수 있다. 이 로컬 구현은 같은 canonical authority를 공유한다는 전제다.

## 무료 합성 검증

`python scripts/dev.py test-independent`: Node 모델에서 복수 ingress, 동시 실패 시도, durable 상태 재사용 재시작, credential generation 증가/감소/충돌, malformed state, 저장소·authority 장애와 실패 시 위임 금지를 검증한다.

`python scripts/dev.py test-independent-runtime`: 실제 빌드된 독립 Worker와 export된 authority를 로컬 workerd 3개 서비스(두 ingress+authority) 및 로컬 SQLite persistent directory로 실행한다. 여러 번의 Miniflare 프로세스 재생성 후 session 유지/로그아웃 폐기/새 credential generation 및 rollback 거부를 확인한다. 별도 fixture에서는 두 ingress에서 동시에 12회 잘못된 로그인을 보내 정확히 5회 401, 7회 429 및 재시작 후 429를 확인한다. 외부 네트워크 요청은 실패 처리하며 synthetic 상태 디렉터리는 종료 후 제거한다.

이 테스트는 실제 다른 지역의 Cloudflare 배포나 장애 주입이 아니다. 최초 runtime test의 외부 synthetic Origin은 Miniflare 자체 local proxy에서 403을 받았다. guard를 끄지 않고 loopback Origin으로 테스트를 수정했다. 실제 HTTPS 검증은 별도다.

## 실제 운영 선택만 보류

1. **같은 소유자 DO authority 사용:** 현재 후보를 이어갈 수 있다. 실제 namespace/binding과 owner secret 설정, generation 교체/rollback 절차, 저장소 보존/복원, 계정 무료 한도·CPU·과금 차단 상한, 접근 정책 검토가 필요하다. 단일 소유자 직렬 처리에 맞는 구조이며 모든 보호 API가 authority round trip에 의존하므로 지연·가용성 검증이 필요하다. 원격 생성은 별도 승인 전 실행하지 않는다.
2. **검증된 독립 identity provider/중앙 세션 서비스:** 사용자 인증과 재설정·보호 정책을 위임할 수 있다. 새 계정·OAuth/credential·정책과 서버 측 revoke/introspection 의미를 확인해야 하므로 현재 권한에서 설정하지 않는다. stateless token 만료만으로 즉시 logout 무효화를 대체할 수는 없다.

현재 후보는 첫 선택지를 코드로 합성 검증했지만 실제 운영 자원/인증 정책을 확정하거나 생성하지 않았다. 비용이 드는 호출, 실제 지도 API, 운영 설정/데이터 변경, GitHub 게시와 배포도 하지 않았다.

공식 근거: [Durable Objects 개념](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/), [저장소와 code update 설명](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/), [상태·동시성 API](https://developers.cloudflare.com/durable-objects/api/state/). 실제 서비스 보장은 Cloudflare 제공 계약과 실제 배포 검증을 별도로 확인해야 한다.
