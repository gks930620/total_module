# devtool_web — total_module 편입 + Railway 첫 배포 준비

> devtool_web 을 total_module(통합 저장소 = Railway 프로젝트 1개)의 새 서비스로 편입해 배포하기까지의
> 상태 진단과 남은 작업. 기준: `architecture` 스킬(편입 절차 §4) · `railway-deploy` 스킬(새 모듈 첫 배포 B).
> **git 관리 주체는 total_module 이다.** 원본 폴더(`simple_side/devtool_web`)는 이관 전 히스토리 보관소일 뿐, 더 이상 보지 않는다.

## 0. 결론 요약

- **배포 형태**: total_module 의 세 번째 서비스. (모듈 1개 = 서비스 1개, 루트 단일 Dockerfile + `APP_MODULE` 로 선택)
- **가장 싼 모듈**: 서버 API 0개 · DB 0개 · 파일 저장 0개 → **MySQL 스키마 불필요, Storage Bucket 불필요.**
  Railway 리소스는 서비스 1개 + 도메인 1개가 전부. App Sleeping ON 이면 유휴 비용도 거의 없다.
- **배포 적합화는 이미 충족**: `/healthz` · fail-fast(`RailwayDeploymentValidator`) · `${PORT:...}` ·
  `forward-headers-strategy: framework` · 프론트 빌드 npm 가드(`onlyIf`) · `static/` 커밋 · Spring Boot 3.3.4/Java 17(기존 모듈과 동일).

## 1. 편입 진행 상태

### 완료 ✅

- [x] 폴더 복사: `total_module/devtool_web/` (사용자가 직접 수행. `.claude/`·`my참고.txt` 는 제외함, `공부/` 는 포함해 커밋 대상)
- [x] 복사본 내부 `.git` 삭제 — gitlink(중첩 저장소) 사고 방지
- [x] 산출물 ignore 확인 — `node_modules/` `build/` `out/` `.gradle/` `.idea/` `logs/` `frontend/dist/` `*.iml` `.env` 전부 ignore,
      `src/main/resources/static/` 은 커밋 대상 (devtool_web 자체 `.gitignore` 가 그대로 동작)
- [x] 루트 `settings.gradle` — `include 'devtool_web'`
- [x] 루트 `Dockerfile` — `COPY devtool_web` · `:devtool_web:bootJar` · jar 추출/복사 · start.sh `APP_MODULE` 허용 목록
- [x] 루트 `.dockerignore` — `devtool_web/logs` `devtool_web/frontend/dist` 추가
- [x] 루트 `build.gradle` — `bootJarAll` 에 `:devtool_web:bootJar` 추가
- [x] **루트 Gradle(9.0.0)로 빌드·테스트 검증** — `:devtool_web:test` `:devtool_web:bootJar` BUILD SUCCESSFUL
      (이 과정에서 `copyFrontendBuild` 도 자동 실행돼 static 이 최신 프론트 빌드로 갱신됨)
- [x] 프론트 단위테스트 — `npm test -- --run` 930건 전부 통과
- [x] total_module 문서 반영 — `.claude/CLAUDE.md` 모듈 목록·스택 표, `total_설계/아키텍처_및_편입기준.md` 구조,
      `architecture` 스킬 구조, `기억할거/devtool_web 기억할 내용.md` 생성

- [x] 기존 두 모듈 회귀 확인 — `:businesscard_qr:test` `:doll_gacha:test` BUILD SUCCESSFUL

### 남은 것

- [ ] qa 관문(실브라우저 시나리오) — 배포 전 조건
- [ ] 커밋 → master merge + push (**push = 자동 배포 트리거.** §2 의 Railway 준비와 순서 맞출 것. 사용자 요청 시에만 실행)
- [ ] Railway 서비스 생성 + env(§2) → 배포 확인(§3) → 문서 정리(§5)

## 2. Railway 리소스 + 환경변수

> **진행 방식(사용자와 합의됨)**: env 관련 파일 수정은 전부 Claude 가 한다.
> Railway **대시보드에 넣을 값이 필요해지면 Claude 가 "어느 서비스에 무슨 변수"라고 알려주고**,
> 사용자가 값을 알려주거나 대시보드에 입력한다.

### 2-1. 서비스 생성 (대시보드)

1. total_module 프로젝트에서 `+ New → Service → GitHub Repo(total_module)` → 서비스 이름 **`devtool_web`**
2. Settings: Branch `master`, **Root Directory 비움(`/`)** ⚠️ 모듈 폴더를 고르는 게 아니다, Build/Start 비움, Healthcheck `/healthz`
3. `Networking → Generate Domain` → **생성된 도메인을 Claude 에게 알려줄 것** (env 값과 sitemap 반영에 필요)
4. 배포 확인 후 **App Sleeping ON** (Settings → Serverless). Hard limit 은 워크스페이스 공통이라 추가 설정 없음.

**만들지 않는 것**: MySQL 스키마 ❌ · Storage Bucket ❌ (이 모듈은 DB·파일 저장이 없다)

### 2-2. 서비스 환경변수 (devtool_web 서비스 Variables — 이 3개가 전부)

| 변수 | 값 | 비고 |
|---|---|---|
| `APP_MODULE` | `devtool_web` | 루트 start.sh 가 이 값으로 실행 jar 선택 |
| `SPRING_PROFILES_ACTIVE` | `prod` | ⚠️ 이 모듈은 프로파일 기본값이 local(`spring.profiles.default`) — 없으면 local 로 뜬다. 루트 start.sh 는 프로파일을 정해주지 않는다 |
| `APP_PUBLIC_BASE_URL` | `https://<생성된 도메인>` | 미설정/localhost 면 fail-fast 로 기동 실패(의도된 동작) |

`PORT` 는 Railway 가 주입(직접 설정 금지). `SPRING_DATASOURCE_*`·`BUCKET_*`·JWT 는 **전부 불필요**.

### 2-3. 도메인 확정 후 파일 반영 (Claude 작업)

- [ ] `frontend/public/sitemap.xml` 의 `<loc>`(현재 상대 경로) → 절대 URL 치환
- [ ] `frontend/public/robots.txt` 의 `Sitemap:` 줄 → 절대 URL 치환
- [ ] `.env.example` 의 예시 URL 을 실제 도메인으로 갱신
- [ ] public/ 변경은 빌드를 거쳐야 반영 → `copyFrontendBuild` 재실행 + static 재커밋
- [ ] (커스텀 도메인 구매 시) 같은 절차 반복 + 서치콘솔/서치어드바이저 sitemap 제출

## 3. 배포 확인 (Verify)

- [ ] `https://<도메인>/healthz` → `{"status":"UP"}`
- [ ] 홈 `/` 렌더 — 빈 화면이면 십중팔구 static 미반영(copyFrontendBuild 누락)
- [ ] 도구 URL **직접 접속**(새로고침 포함): `/convert` `/pdf` `/image-privacy` `/erd` 등
  - 특정 URL 만 403 → `SecurityConfig` 화이트리스트 누락 (로컬 재현 안 됨 — `tools.test.js`·`SpaRouteApiIntegrationTest` 먼저)
- [ ] 네트워크 탭: 도구 사용 중 외부 요청 0건 (예외: Google Fonts, `/og-preview` 의 og:image)
- [ ] `railway logs -s devtool_web -d --lines 50` 에 에러 없음 (`Started DevToolboxApplication`)
- [ ] 첫 요청 10~30초 지연은 App Sleeping 콜드스타트 — 정상

## 4. devtool_web 특이점 (기존 두 모듈과 다른 점 — 운영 시 기억)

- 프로파일 기본값이 local → 운영은 `SPRING_PROFILES_ACTIVE=prod` env 필수 (§2-2)
- DB env 가 하나도 없다 — fail-fast 검증 대상은 `APP_PUBLIC_BASE_URL` 하나뿐
- 로컬 포트 8082 고정(application-local.yml) — 다른 모듈과 로컬 동시 기동 가능
- **배포 이미지는 node 없이 빌드** → 프론트를 고쳤으면 `copyFrontendBuild` 로 static 을 갱신해 **커밋까지** 해야 반영된다
  (빠뜨리면 빌드는 성공하는데 사이트가 빈 화면 — 로그에 에러도 안 남는다)
- 모듈 폴더의 `Dockerfile`·`gradlew`·`settings.gradle` 은 로컬 단독 실행용으로 유지 (doll_gacha 와 같은 방식)

## 5. 편입 후 문서 정리 (현재 상태만 남기기)

- [ ] `설계/07_배포_Railway.md` — 단독 배포 전제를 편입 배포(루트 Dockerfile·`APP_MODULE`) 기준으로 재작성
- [ ] `README.md` — 배포 행(Railway 단일 컨테이너 → total_module 서비스)·문서 지도 갱신
- [ ] `진행사항/인수인계.md`·`다음_할일.md` — 편입 완료 상태 반영
- [ ] 이 문서 — 배포까지 끝나면 체크리스트를 정리하고 운영 메모(§4)는 `기억할거/` 로 이관
