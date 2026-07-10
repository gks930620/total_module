# doll_gacha 로컬 동작 오류 해결 (2026-07-10)

> 환경: 로컬 실행(기본 `local` 프로파일 = **H2 파일 모드** + `spring.sql.init`로 시드 로드), `http://localhost:8080`
> 성격: 배포가 아니라 **로컬에서 화면이 깨지던 3가지 문제**의 원인 분석 + 수정 기록
> 결론: 3가지가 일부 **서로 연결**돼 있었음 (특히 ①은 ②의 결과)

---

## 요약표

| # | 증상 | 근본 원인 | 수정 |
|---|------|-----------|------|
| ② | 매장/커뮤니티 목록·상세의 **한글이 다 깨짐** (HTML은 정상) | 시드 `.sql`은 UTF-8인데 `spring.sql.init.encoding` 미설정 → **JDK17 + 한글 Windows가 CP949로 읽어** 깨진 채 INSERT | `application.yml`에 `spring.sql.init.encoding: UTF-8` + **기존 H2 파일 삭제 후 재시드**(아래 5) |
| ① | `/map`에서 **인형뽑기 가게 마커가 안 뜸** | ②의 결과 — 지도 조회가 `WHERE gubun1 = '서울특별시'`로 거르는데 DB의 지역명이 깨져 있어 **매칭 0건** → 마커 없음 | ②를 고치면 해결 (지역명이 정상 저장되어 필터 매칭됨) |
| ③ | `/community` 등에서 `GET /images/default-shop.png` **DEBUG 로그가 콘솔에 무한 도배** | (a) `FileController`의 `GET /images/**` 매핑이 정적 리소스 `static/images/default-shop.png`를 **가려서 404** → (b) 프론트 `img onError`가 **같은 URL을 무한 재요청** → (c) 보안 로그가 요청마다 DEBUG로 찍힘 | (a) 죽은 `/images/**` 컨트롤러 제거 → 정적 핸들러가 서빙(200), (b) `onError` 무한루프 가드, (c) security 로그 DEBUG→INFO |

---

## ② 한글 인코딩 깨짐 (가장 근본, ①의 원인이기도 함)

### 원인
- 시드 파일(`data-dollshop.sql` 등)은 **UTF-8**로 저장돼 있음(확인함).
- 로컬은 `spring.sql.init.mode: always`로 이 시드를 실행하는데, **읽을 때 인코딩(`spring.sql.init.encoding`)이 지정돼 있지 않았다.**
- Spring은 이 값이 없으면 **JVM 기본 문자셋**으로 스크립트를 읽는다. **JDK 17**은 (JEP 400의 UTF-8 기본화가 JDK 18부터라) 한글 Windows에서 기본 문자셋이 **CP949(MS949)**다.
- 결과: UTF-8 한글을 CP949로 잘못 해석 → **깨진 문자열이 그대로 DB에 INSERT**됨. 그래서 "HTML은 멀쩡한데 DB에서 온 값만 깨지는" 현상.

### 수정
`doll_gacha/src/main/resources/application.yml`
```yaml
spring:
  sql:
    init:
      mode: always
      encoding: UTF-8   # ← 추가
```

### ⚠️ 사용자 조치 필요 (중요)
이미 **깨진 채 저장된 H2 데이터**는 설정만 바꾼다고 고쳐지지 않는다. **기존 H2 파일을 지우고 재시드**해야 한다:
1. 앱 종료
2. `doll_gacha/data/` 폴더의 `doll_gacha.mv.db`(및 `*.trace.db`) 삭제
3. 앱 재시작 → 시드가 UTF-8로 다시 로드되어 정상 한글로 저장됨

---

## ① `/map` 마커 안 뜸

### 원인
- 지도는 `GET /api/doll-shops/map?gubun1=서울특별시`로 가게를 조회한다.
- 서버 쿼리는 `dollShop.gubun1.eq("서울특별시")`로 필터한다(`DollShopRepositoryCustomImpl.searchForMap` / `eqGubun1`).
- ②로 인해 DB의 `gubun1`이 깨져 있어서 **정상 문자열 "서울특별시"와 매칭되지 않음** → 결과 0건 → 마커 없음.
- (지도 SDK·좌표(lat/lng는 숫자라 안 깨짐)는 정상 — 지도 자체는 렌더됨)

### 수정
- **별도 코드 수정 없음.** ②(인코딩 + 재시드)를 적용하면 지역명이 정상 저장되어 필터가 매칭되고 마커가 뜬다.
- 확인 포인트: 재시드 후 `/map`에서 서울 선택 시 마커가 보이는지. 안 보이면 시드에 해당 지역 데이터가 있는지 별도 확인.

---

## ③ `default-shop.png` 요청·로그 무한 도배

### 원인 (3중 복합)
1. **라우팅 가림**: `FileController`에 `@GetMapping("/images/{filename:.+}")`가 있었고, 이게 업로드 폴더(`./uploads/`)에서 파일을 찾았다. 그런데 기본 이미지는 `src/main/resources/static/images/default-shop.png`(정적 리소스)에 있다. **컨트롤러 매핑이 정적 리소스 서빙보다 우선**하므로 `/images/default-shop.png` → 업로드 폴더에서 탐색 → 없음 → **404**.
   - 참고: 실제 업로드 파일은 `/uploads/**`(WebConfig 리소스 핸들러)로 서빙되므로, 이 `/images/**` 컨트롤러는 사실상 **쓰이지 않는 죽은 경로**였다.
2. **프론트 무한 재요청**: 목록/상세의 `<img onError={(e) => e.target.src = '/images/default-shop.png'}>`가, 그 폴백 이미지 자체가 404가 나자 **onError를 또 발생시켜 같은 URL을 무한 재요청**했다.
3. **로그 도배**: 요청 하나마다 Spring Security가 `Securing/Secured GET ...`을 **DEBUG**로 찍는데(logback-spring.xml), 위 무한 요청과 겹쳐 콘솔이 도배됨.

### 수정
- **(a) 죽은 컨트롤러 제거** — `FileController`의 `GET /images/**` (`serveFile`) 삭제. 이제 `/images/**`는 Spring 기본 정적 핸들러가 처리 → `static/images/default-shop.png`가 정상 200. (`loadLocalFile` 헬퍼는 다운로드에서 계속 쓰므로 유지)
- **(b) onError 무한루프 가드** — `DollShopListPage.jsx`, `DollShopDetailPage.jsx`의 `onError`가 **한 번만** 폴백하도록:
  ```jsx
  onError={(e) => {
    if (e.target.dataset.fallback) return
    e.target.dataset.fallback = '1'
    e.target.src = '/images/default-shop.png'
  }}
  ```
- **(c) 로그 완화** — `logback-spring.xml`에서 `org.springframework.security` 레벨 **DEBUG→INFO** (요청마다 찍히던 Securing/Secured 로그 제거).

> 프론트를 고쳤으므로 `gradlew copyFrontend`로 `static/`에 재빌드해 반영함.

---

## 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `src/main/resources/application.yml` | `spring.sql.init.encoding: UTF-8` 추가 (②) |
| `src/main/java/.../file/controller/FileController.java` | 죽은 `GET /images/**` serveFile 제거 (③a) |
| `frontend/src/pages/dollshop/DollShopListPage.jsx` | onError 무한루프 가드 (③b) |
| `frontend/src/pages/dollshop/DollShopDetailPage.jsx` | onError 무한루프 가드 (③b) |
| `src/main/resources/logback-spring.xml` | security 로그 DEBUG→INFO (③c) |
| `src/main/resources/static/assets/*` | 프론트 재빌드 산출물(copyFrontend) |

## 검증
- `gradlew copyFrontend test` — 프론트 재빌드 + 백엔드 테스트 (결과는 커밋 메시지/대화 참고)
- serveFile 삭제 후에도 기존 테스트 `serveFile_notFound`는 통과(정적 핸들러가 없는 파일에 404 반환).

## 사용자가 직접 할 것
1. **H2 파일 삭제 후 재시작** (②의 재시드) — `doll_gacha/data/doll_gacha.mv.db` 삭제
2. 재시작 후 확인: 목록/상세 한글 정상, `/map` 마커 표시, `/community` 콘솔에 default-shop 도배 사라짐
