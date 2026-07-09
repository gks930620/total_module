# 코드 품질 점검 — doll_gacha (2026-07-08)

> 성격: **점검(리뷰)만** — 코드는 하나도 수정하지 않음. 나중에 "N번 고쳐줘"로 골라서 시키면 됨.
> 범위: `doll_gacha/src/main/java`(전 패키지), `src/test/java`, `frontend/src`. 배포·동작은 정상, 이 문서는 "더 낫게" 관점.
> 표기: 난이도 소/중/대 · 우선순위 높음/중간/낮음 · [BUG]=실제 버그성

---

## 0. 총평

**전반적으로 잘 짜여 있음.** 서비스는 얇고 일관적이며(readOnly 트랜잭션 + 쓰기만 `@Transactional`, 공통 검증 메서드 추출), 컨트롤러는 위임만 하고, 조회는 Repository에서 DTO로 직접 프로젝션해 **N+1을 구조적으로 회피**한다. System.out·printStackTrace·주석처리된 죽은 코드·console.log가 **하나도 없고**, 프론트는 토큰을 localStorage가 아니라 쿠키로 다뤄 보안적으로도 양호하다.

아래는 "굳이 더 낫게 한다면" 수준의 개선점들이다. **높음 우선순위도 대부분 소규모**다.

---

## 1. 불필요한 코드 / 정리

| # | 위치 | 내용 | 개선 | 난이도·우선순위 |
|---|------|------|------|------|
| J1 | `src/main/generated/**` (Q클래스 7개) | QueryDSL 생성물이 **git에 커밋돼 있음**. 빌드마다 재생성되는 산출물이라 커밋 대상이 아님(소스와 어긋나면 혼란) | `.gitignore`에 `src/main/generated/` 추가 + git에서 제거. 빌드는 annotationProcessor가 자동 생성 | 소 · **높음** |
| J2 | `DemoApplication.java` | 메인 클래스명이 `DemoApplication` (businesscard_qr도 같은 문제로 `BusinessCardApplication`으로 개명했음) | `DollGachaApplication`으로 개명(+ 테스트 `DemoApplicationTests`도) | 소 · 중간 |
| J3 | `doll_gacha/.github/workflows/deploy.yml` | 옛 단독 배포용 워크플로. 루트가 아니라서 **실행 안 되는 죽은 파일** | 삭제 (배포는 total_module 루트에서) | 소 · 중간 |
| J4 | `file/controller/FileController.java:43-71` `serveFile` | `/images/**` 로컬 파일 서빙 — prod는 Supabase CDN이라 **prod에서 사실상 죽은 경로**. dev 전용임이 주석에만 있음 | 유지하되 dev 전용임을 명확히(프로파일 게이팅 or 문서화). 삭제까진 불필요 | 소 · 낮음 |
| J5 | `data-*.sql` (community/comment/review/files/users/dollshop) | 시드 6종 — prod `sql.init.mode: never`라 안 돎(정상). local 전용인데 위치상 오해 소지 | 유지 OK. `data-users.sql`에 테스트 계정 있으면 비밀번호만 점검 | 소 · 낮음 |

---

## 2. 구조 / 일관성

| # | 위치 | 내용 | 개선 | 난이도·우선순위 |
|---|------|------|------|------|
| J6 | `FileController.java:191` | `downloadFile`에 `catch (Exception e) → 500`. **같은 컨트롤러의 다른 메서드들은** "GlobalExceptionHandler가 처리"라고 주석까지 달며 try/catch를 안 쓰는데 여기만 광범위 catch → 일관성 깨짐 + 진짜 원인 은폐 | 광범위 catch 제거하고 GlobalExceptionHandler에 위임(필요 예외만 명시적으로) | 중 · 중간 |
| J7 | `FileController.java:151-155` | `getFileById`가 **null 반환** 후 컨트롤러에서 null 체크 → 나머지 코드베이스는 전부 `orElseThrow(EntityNotFoundException)` 패턴 | 서비스가 `EntityNotFoundException.of("파일", fileId)` 던지도록 통일 → 컨트롤러 null 체크 제거 | 소 · 중간 |
| J8 | `FileController.java:44-71` vs `147-195` | 로컬 파일 경로 해석(`uploadPath.resolve(...).normalize()` + 존재/가독 체크) 로직이 두 메서드에 **중복** | 공통 헬퍼(`resolveLocalFile`)로 추출 | 소 · 낮음 |
| J9 | `HomeController.java:19-29` | SPA forward 경로를 **손으로 나열** — React 라우트 추가 시마다 여기도 고쳐야 함(누락 시 새 페이지 새로고침이 404) | `/api/**`·정적·oauth 제외한 나머지를 한 번에 forward하는 fallback 방식 검토(단, 정적/에러 경로 충돌 주의) | 중 · 낮음 |

---

## 3. 가독성 / 관용구

| # | 위치 | 내용 | 개선 | 난이도·우선순위 |
|---|------|------|------|------|
| J10 | 응답 DTO 19개 (`*DTO` class) | 대부분 `@Getter @Setter @Builder`의 **가변 클래스**. 응답 전용 DTO는 불변이 안전(setter 노출 불필요). record는 1개뿐 | 응답 DTO를 **record**로 전환(요청 DTO는 검증/바인딩 때문에 class 유지 무방). 점진적으로 | 중 · 낮음 |
| J11 | `ReviewService.java:47-49` | `stats == null || stats.getTotalReviews() == null || stats.getTotalReviews() == 0` 3중 널체크 | Repository가 애초에 빈 통계를 반환하게 하거나 `Optional`/기본값 처리로 단순화 | 소 · 낮음 |
| J12 | `CommunityDTO.java:44` | `.commentCount(0L) // 실제 값은 Repository에서 설정` — 기본값과 실제값 세팅 지점이 분리돼 추적 어려움 | Repository 프로젝션에서 한 번에 채우거나, 주석 의도를 메서드명으로 표현 | 소 · 낮음 |
| J13 | `FileController.java:58-60` | content-type을 `if/else if` 확장자 분기로 수동 결정 | `Files.probeContentType` 또는 `MediaTypeFactory.getMediaType(filename)` 사용 | 소 · 낮음 |

> for문→stream 후보는 거의 없음 — 이미 `files.stream().filter().map().toList()`(FileController:107) 등 스트림을 적절히 쓰고 있음. **이 항목은 지적할 게 별로 없다(좋은 뜻).**

---

## 4. 테스트

**커버리지는 양호** (13개 테스트 클래스, 77 통과). 컨트롤러 대비 공백만 정리:

| # | 위치 | 내용 | 개선 | 난이도·우선순위 |
|---|------|------|------|------|
| T1 | `StatusController`(/healthz) | 전용 테스트 없음 — 배포 헬스체크의 생명줄인데 미검증 | 200 + `{status:UP}` 스모크 테스트 1건 | 소 · 중간 |
| T2 | `HomeController`(SPA forward) | forward 라우팅 테스트 없음 → J9와 연결(라우트 누락이 조용히 통과) | 주요 경로가 `forward:/index.html` 되는지 `@WebMvcTest` 1건 | 소 · 낮음 |
| T3 | `Oauth2LoginController` | 직접 테스트 없음(핸들러/로그인 통합으로 일부만 커버) | 시나리오 기준 보강 여지 | 중 · 낮음 |
| T4 | 통합 테스트 다수 `@SpringBootTest` | 컨트롤러 슬라이스로 충분한 것들이 풀 컨텍스트 → 느림 | 순수 웹 계층 검증은 `@WebMvcTest`로 경량화 검토(선택) | 중 · 낮음 |
| T5 | 테스트 DB = H2, 운영 = MySQL | dialect 차이로 **일부 쿼리(특히 QueryDSL 커스텀)가 H2에선 통과, MySQL에선 다르게 동작**할 여지 | 핵심 repository 테스트는 Testcontainers(MySQL)로 승격 검토(여력 될 때) | 대 · 낮음 |

---

## 5. 프론트엔드 (React)

| # | 위치 | 내용 | 개선 | 난이도·우선순위 |
|---|------|------|------|------|
| F1 | `pages/review/ReviewForm.jsx`(348줄) **와** `pages/dollshop/components/ReviewForm.jsx`(200줄) | **같은 "리뷰 입력 폼"이 두 벌** 존재 (별점/기계힘/비용/내용/이미지). 하나는 write·edit 공용, 하나는 가게 상세 인라인용 — 필드·검증 로직이 갈라져 유지보수 이중 부담 | 공용 폼 1개로 통합하고 props(mode/onSubmit)로 분기 | 중 · **중간** |
| F2 | `pages/**/*Page.jsx` 전반 (useEffect 14곳) | 목록/상세 페이지마다 `loading/error/data` useState + useEffect fetch 패턴 **복붙** 반복 | `useApi`/`useFetch` 커스텀 훅으로 추출(기존 `lib/http.js` 위에) → 각 페이지 수십 줄 감소 | 중 · 중간 |
| F3 | `DollShopDetailPage.jsx`(387), `MapPage.jsx`(387) | 단일 컴포넌트가 과대 — 렌더+데이터+이벤트 혼재 | 하위 컴포넌트/훅으로 분리(가독성) | 중 · 낮음 |
| F4 | community/dollshop/review의 List/Detail/Edit 3종 페이지 | 페이지 스캐폴딩(헤더/페이징/카드) 유사 구조 반복 | 공통 `<ListPage>`/`<Pagination>` 등 추출 검토 | 중 · 낮음 |

> 프론트 **좋은 점**: `lib/http.js`로 fetch 일원화 + `credentials:'include'`(쿠키 인증), console.log 잔재 0, localStorage 토큰 저장 안 함(보안 양호).

---

## 6. 잘 되어 있는 점 (유지 권장)

- **서비스 계층**: `@Transactional(readOnly=true)` 클래스 기본 + 쓰기 메서드만 `@Transactional`, 권한 검증 공통 메서드 추출(`findReviewByIdAndValidateUser` 등), 도메인 로직은 엔티티에(`community.update()`, `softDelete()`, `isWrittenBy()`)
- **N+1 회피**: 조회를 Repository에서 DTO로 직접 프로젝션(`searchCommunity`, `findReviewsWithFilesByDollShopId`) — loop 쿼리 없음
- **예외 처리 일원화**: `GlobalExceptionHandler` + 커스텀 예외(`EntityNotFoundException.of(...)`, `AccessDeniedException.forUpdate/forDelete`) — 메시지·상태코드 일관 (FileController J6/J7만 예외)
- **테스트 시간 주입**: `createReview(username, dto, LocalDateTime now)`로 시간을 파라미터화 → "하루 1회" 규칙을 결정적으로 테스트 가능
- **깨끗함**: 죽은 주석/System.out/TODO 남발 없음(유일한 TODO는 InMemoryAuthorizationRequestRepository의 Redis 전환 안내로 정당)

---

## 7. 추천 처리 순서 (원하면 이 순서로)

1. **J1** generated 커밋 제거 (.gitignore) — 소, 높음
2. **J2 / J3** DemoApplication 개명 + 죽은 workflow 삭제 — 소
3. **J6 / J7** FileController 예외처리 일관화 — 소~중
4. **T1** healthz 스모크 테스트 — 소
5. **F1 / F2** 프론트 ReviewForm 통합 + useApi 훅 — 중 (효과 큼)
6. 나머지(J8~J13, T2~T5, F3~F4)는 여력 될 때

> ⚠️ 주의: 이 문서는 **핵심 파일 위주의 집중 점검**(전 패키지 커버, 라인 단위 전수는 아님)이다. 특히 QueryDSL 커스텀 Impl 3종(`DollShopRepositoryCustomImpl` 192줄 등)과 `SecurityConfig`(244줄), `JwtLoginFilter`는 동작 검증됨(테스트 통과)이라 이번엔 세부 리팩터 지적을 생략했다 — 원하면 그 파일들만 심화 리뷰 가능.
