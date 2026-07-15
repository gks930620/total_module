# doll_gacha 코드 점검 결과 (2026-07-15)

> 배포·동작이 정상인 상태에서 **전체 코드 점검**(백엔드·프론트 병렬 리뷰)한 결과.
> **결론: 치명적 버그·배포 blocker 없음. 기본기는 탄탄.** 아래는 대부분 "더 나은 코딩"을 위한 개선 포인트이며, **딱 1개(파일 삭제 IDOR)만 실제 보안 이슈**라 우선 처리 권장.
> 상태: **✅ 전부 구현·검증 완료** (브랜치 `doll_gacha_오류해결`, 2026-07-15 — 백엔드 테스트 + 프론트 빌드 통과). 상세 개념은 [`doll_gacha_남은개선_설명_2026-07-15.md`](doll_gacha_남은개선_설명_2026-07-15.md).
> (파일 수명주기 refId=0 연결/orphan/삭제 cascade 는 별개로 [`total_설계/코드컨벤션.md`](../total_설계/코드컨벤션.md) §5-3-1에 정리됨 — **이 항목만 미구현**, 나중에.)

---

## 요약 (우선순위)

| 순위 | 항목 | 성격 | 상태 |
|---|---|---|---|
| 🔴 HIGH | 파일 삭제에 소유자 검증 없음 (IDOR) | **보안** | ✅ 적용 |
| 🟡 MED | 예외 핸들러가 표준 4xx를 500으로 덮음 | 컨벤션 위반 | ✅ 적용 |
| 🟡 MED | OAuth 외부 API 호출이 트랜잭션 안 | 안티패턴 | ✅ 적용 |
| 🟢 LOW | 리뷰 "하루 1회" TOCTOU 경쟁 | 정확성 | ✅ 적용 |
| 🟢 LOW | 조회수 증가 비원자적(lost update) | 정확성 | ✅ 적용(+쿠키 dedup) |
| 🟢 LOW | 페이지 크기 상한(100) 미보장 | 안정성 | ✅ 적용 |
| 🟢 LOW | JWT 시크릿 길이 미검증(fail-fast 아님) | 견고성 | ✅ 적용 |
| 프론트 | refresh 실패 시 동시요청 hang / 콜드스타트 안내 없음 | UX·견고성 | ✅ 적용 |

---

## 🔴 HIGH — 파일 삭제 IDOR (유일한 실제 보안 이슈)

- **위치**: `file/controller/FileController.java` (`DELETE /api/files/{fileId}`) → `file/service/FileService.java:96` (`deleteFile`) · `jwt/config/SecurityConfig.java` (`DELETE /api/files/**` = `authenticated()`)
- **문제**: 삭제 API는 로그인만 요구하고, `deleteFile(fileId)`는 fileId로 조회 후 **작성자/소유자 확인 없이** 메타 + 버킷 바이트를 삭제한다.
- **영향**: 로그인한 **아무 사용자나 `fileId`를 1,2,3…로 열거**하며 **타인의 리뷰/게시글 첨부·이미지를 영구 삭제**(버킷 객체까지) 가능.
- **왜 문제인가**: Community/Review/Comment는 서비스에서 `isWrittenBy()`로 소유자 검증하는데 **파일만 빠짐**. [`코드컨벤션.md`](../total_설계/코드컨벤션.md) §4-1 "by-id 접근엔 인가 체크 필수" 위반.
- **권장 수정**: 삭제 전 그 파일의 `refId`(대상 글/리뷰) **소유자인지 검증** 후 삭제. (또는 파일 삭제를 글/리뷰 삭제의 하위로만 허용)

---

## 🟡 MEDIUM

### 예외 핸들러가 표준 4xx를 500으로 덮음
- **위치**: `common/exception/GlobalExceptionHandler.java` (`@ExceptionHandler(Exception.class)` → 500)
- **문제**: Spring MVC 표준 예외 전용 핸들러가 없어 catch-all(Exception→500)이 먼저 흡수. 결과:
  - 메서드 불일치(원래 405), Content-Type 불일치(415/406), no-handler(404), 멀티파트 파트 누락(400) → **전부 500**
- **영향**: 잘못된 요청이 클라이언트에 5xx로 보고 → **API 계약 위반** + Railway 모니터링에서 실제 서버오류와 구분 불가. [`코드컨벤션.md`](../total_설계/코드컨벤션.md) §2("표준 4xx 보존") 위반.
- **권장 수정**: `ResponseEntityExceptionHandler` 상속(프레임워크 예외 상태코드 보존) 또는 표준 예외 전용 핸들러 추가.

### OAuth 외부 API 호출이 @Transactional 경계 안
- **위치**: `jwt/service/AppOAuth2Service.java:33` (`@Transactional login()`에서 `socialTokenVerifier.verify()` HTTP 호출), `jwt/service/CustomOAuth2UserService.java:20` (`loadUser()`에서 provider userinfo HTTP)
- **문제**: 트랜잭션 안에서 네트워크 I/O. (Hibernate 지연 커넥션이라 최악은 피하지만 안티패턴)
- **영향**: prod HikariCP `maximum-pool-size: 10`에서 provider 지연/타임아웃 시 트랜잭션이 길게 열림. 향후 호출 앞에 DB 접근이 추가되면 **커넥션 풀 고갈**로 번질 수 있음.
- **권장 수정**: 외부 토큰 검증을 트랜잭션 밖으로 분리.

---

## 🟢 LOW (여유될 때)

- **리뷰 "하루 1회" TOCTOU** — `review/ReviewService.java:70` `existsBy...CreatedAtBetween` 확인 후 `save()`. 동시 더블서브밋 시 둘 다 통과 → 같은 날 중복 생성. DB 유니크 제약도 없음. → (유저,가게,날짜) unique index 또는 잠금.
- **조회수 비원자적** — `community/CommunityService.java:56` + `CommunityEntity` `viewCount++`(dirty checking). 동시 조회 시 유실. → `UPDATE community SET view_count = view_count + 1 WHERE id = ?` 원자쿼리. (영향: 조회수 부정확 정도)
- **페이지 크기 상한 미보장** — `common/config/WebConfig.java:20` 에서 `PageableHandlerMethodArgumentResolver`를 로컬 인스턴스로 등록 + `setMaxPageSize(100)`. 빈이 아니라 Spring Data 기본 리졸버(maxPageSize 2000)가 함께 등록됨 → 어느 쪽이 먼저 매칭될지 비결정적 → 100 상한 보장 안 될 수 있음. → `PageableHandlerMethodArgumentResolverCustomizer` 빈으로.
- **JWT 시크릿 길이 미검증** — `common/config/RailwayDeploymentValidator.java` 는 공백만 확인. `JwtUtil`의 HS256은 32바이트 미만이면 런타임 `WeakKeyException` → 짧은 시크릿은 부팅 성공 후 **첫 로그인에서 500**. (현재 값은 32바이트라 지금은 정상) → 검증기에서 바이트 길이(≥32)까지.
- **IllegalStateException 일괄 409** — `GlobalExceptionHandler` 가 모든 `IllegalStateException`을 409로. 무관한 내부 예외도 409로 나갈 수 있음.

---

## 프론트엔드

- ❌ **(오탐) 리뷰 삭제 버튼 안 뜸** — 리뷰어가 낡은 주석만 보고 판단. 실제 `MyInfoResponse`에 `id`가 있고 `AuthContext`가 그대로 저장하므로 **정상 동작.** 무시.
- ⚠️ **refresh 실패 시 동시요청 hang** — `lib/http.js` 에서 토큰 refresh가 *실패*하면 대기 큐(`refreshSubscribers`)를 콜백 호출 없이 비워, 그 사이 들어온 동시 인증요청 Promise가 영영 resolve 안 됨. (만료+refresh실패+동시요청 조합에서만, 드묾)
- ⚠️ **콜드스타트 안내 없음** — fetch 타임아웃/"서버 깨우는 중" 처리 없음. **App Sleeping을 켰으니 콜드스타트(10~30초)가 정상 상황** → 첫 접속 시 "..."/"불러오는 중"에서 피드백 없이 멈춘 것처럼 보임(무한행은 아님, 깨어나면 응답). → 로딩 지연 시 "서버 깨우는 중" 안내 권장.
- 🔹 사소: `MapPage.jsx` `console.error` 3건, 카카오 JS 키 하드코딩(클라 노출용이라 취약점 아님).

---

## ✅ Clean 확인 (잘 되어 있는 것 — 건드릴 필요 없음)

- **인가 규칙 전반**: 정적/공개조회 permitAll, 쓰기(POST/PUT/PATCH/DELETE) `authenticated()`, `anyRequest().authenticated()` 화이트리스트. Community/Comment/Review는 `isWrittenBy()` 소유자 검증 있음(파일만 예외 → 🔴#1).
- **CORS**: 명시 origin + `allowCredentials(true)` (와일드카드 아님).
- **쿠키**: `HttpOnly` + `Secure`(prod true/local false) + `SameSite=Lax` 일관 적용.
- **경로 traversal**: `LocalDiskFileStorage.resolveWithinRoot()` 로 업로드 루트 이탈 차단.
- **비밀값**: 전부 환경변수(JWT/OAuth/버킷). 시드의 개인정보/비번은 `data-*.sql`로 **local 전용**(prod `sql.init.mode: never`)이라 미로딩.
- **설정**: prod `ddl-auto: update` + `sql.init.mode: never` 정합, `RailwayDeploymentValidator` fail-fast, `/healthz` 정상.
- **트랜잭션**: 쓰기 메서드 `@Transactional`, 조회 `readOnly=true` (단 🟡 외부호출 위치만 예외).
- 프론트: 모든 API 호출 동일 오리진 상대경로(하드코딩 백엔드 URL 없음), `credentials:'include'` 정상, 이미지 onError 무한요청 가드 존재(default-shop.png 회귀 막힘).

---

## 다음 스텝 (권장)
1. **🔴 파일 삭제 IDOR** — 실제 보안이라 우선 수정.
2. **🟡 예외핸들러·트랜잭션** — 컨벤션 위반이라 같이 잡으면 깔끔.
3. 🟢·프론트 — 여유될 때. 급하지 않음.

> 파일 삭제 IDOR(🔴)는 §5-3-1 파일 수명주기(삭제 cascade) 작업과 함께 처리하면 자연스럽다 — 어차피 삭제 로직에 소유자 검증을 넣게 됨.
