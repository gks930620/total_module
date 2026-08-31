
# Railway 배포 방법 — dev-toolbox

> 담당: devops. **커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 실행한다.**

## ⚠️ 가장 중요한 것 하나

**배포 이미지는 node 없이 빌드된다.** `Dockerfile` 은 JDK 만 있는 `gradle:8-jdk17` 위에서 돌고,
`build.gradle` 의 프론트 빌드 태스크는 `onlyIf { npmAvailable }` 로 가드돼 있어 **전부 skip 된다.**

> 즉 Railway 는 **`src/main/resources/static` 에 들어 있는 산출물을 그대로 패키징한다.**
> 이 폴더가 비어 있거나 오래된 상태로 배포하면 **빌드는 성공하는데 사이트가 안 뜬다**(모든 라우트가
> 존재하지 않는 `index.html` 로 forward → 빈 화면/404). 로그에는 에러가 안 남아서 원인 찾기가 어렵다.

**그래서 배포 전 SPA 재빌드는 선택이 아니라 필수다(아래 2단계).**

---

## 사전 확인 (Prerequisites)

- [ ] Railway 계정 + 프로젝트/서비스 생성됨 (`railway whoami` 로 로그인 확인)
- [ ] git 저장소 초기화 + 원격 연결 (Railway 는 GitHub 연동 배포가 기본)
- [ ] **세 관문 통과** — 이 프로젝트의 배포 전 조건
  - [ ] 프론트 테스트 `cd frontend && npm test -- --run`
  - [ ] 백엔드 테스트 `./gradlew test` (Windows: `JAVA_HOME=C:\Users\gks93\.jdks\corretto-17.0.19`)
  - [ ] qa 판정 통과 (사람이 실제 브라우저로 시나리오 시험)
- [ ] 환경변수 준비: **`APP_PUBLIC_BASE_URL` 하나뿐**
  - 운영에서 미설정이거나 `localhost` 면 `RailwayDeploymentValidator` 가 **기동 시 fail-fast** 한다(의도된 동작)
  - MySQL 서비스·`SPRING_DATASOURCE_*`·`NTS_SERVICE_KEY`·`ALLOWED_ORIGIN` 은 **전부 불필요**
    (2026-08-04 사업자 진위확인 제거로 DB·외부 API 의존이 0이 됐다)

---

## 배포 절차 (Steps)

### 1. 테스트 통과 확인

```bash
cd frontend && npm test -- --run && npm run lint
cd .. && ./gradlew test
```

> ⚠️ **Vite 개발 서버가 떠 있으면 `./gradlew test` 가 실패한다.**
> `frontendInstall`(=`npm ci`)이 `node_modules/@rolldown/...node` 를 지우려는데 파일이 잠겨 EPERM 이 난다.
> → 개발 서버를 끄거나, 백엔드만 볼 거면
> `./gradlew test -x frontendInstall -x frontendBuild -x copyFrontendBuild -x cleanFrontendStatic`

### 2. SPA 산출물을 static 에 반영 (필수)

```bash
./gradlew copyFrontendBuild
```

이 태스크가 `npm ci` → `npm run build` → `static` 비우기 → `dist` 복사를 한 번에 한다.
개발 서버가 켜져 있어 `npm ci` 가 막히면 `-x frontendInstall` 을 붙인다.

**확인**: `src/main/resources/static/index.html` 과 `static/assets/` 가 방금 시각으로 갱신됐는지 본다.

```bash
ls -la src/main/resources/static
```

### 3. 커밋 (사용자가 요청했을 때만)

`static/` 산출물이 **반드시 커밋에 포함돼야 한다.** `.gitignore` 가 이걸 제외하지 않는지 확인할 것.

### 4. Railway 환경변수 설정

| 변수 | 값 | 비고 |
|---|---|---|
| `APP_PUBLIC_BASE_URL` | `https://<서비스>.up.railway.app` | 필수. 도메인 확정 후 실제 도메인으로 교체 |
| `SPRING_PROFILES_ACTIVE` | `prod` | Dockerfile ENTRYPOINT 에 이미 있으나 명시하면 안전 |

`PORT` 는 **Railway 가 주입한다.** 직접 설정하지 말 것 (`application-prod.yml` 이 `${PORT:8080}` 로 받는다).

> 로컬은 `application-local.yml` 에서 **8082 고정**이다(프로파일이 다르므로 운영에 영향 없음).
> 로컬 파일에는 `${PORT:...}` 를 쓰지 않는다 — 환경에 `PORT` 가 남아 있으면 조용히 다른 포트로 떠 버리기 때문이다.

### 5. 배포

GitHub 연동이면 push 하면 자동 배포된다. CLI 라면 `railway up`.

---

## 배포 후 확인 (Verify)

- [ ] `GET /healthz` → `200` (Railway 헬스체크가 이 경로를 본다. Dockerfile HEALTHCHECK 도 동일)
- [ ] 홈 `/` 이 뜨는지 — **안 뜨면 십중팔구 2단계를 건너뛴 것이다**
- [ ] 도구 URL **직접 접속**(새로고침 포함) 몇 개: `/convert` `/pdf` `/image-privacy` `/loan`
  - 특정 URL 만 403 이면 `SecurityConfig` 화이트리스트 누락이다.
    로컬에서는 재현되지 않으니 `frontend/src/lib/__tests__/tools.test.js` 와
    `SpaRouteApiIntegrationTest` 를 먼저 돌려 볼 것
- [ ] **네트워크 탭에서 도구 사용 중 외부 요청 0건**(NFR-02, 이 제품의 핵심 약속)
  - 예외 2건은 정상: ① `index.html` 의 Google Fonts(Material Icons)
    ② `/og-preview` 에서 입력한 `og:image` 주소 (미리보기를 그리려면 실제로 받아와야 한다)
  - `/pdf` 진입 시 받는 pdf-lib 청크(gzip 178KB)는 **자기 서버**에서 오는 것이라 외부 요청이 아니다
- [ ] 5MB / 20MB JSON 성능 실측 (NFR-01)
- [ ] `railway logs` 에 에러 없음

---

## 도메인을 붙일 때 (가비아 등)

1. Railway 서비스에 커스텀 도메인 추가 → 안내되는 CNAME 을 도메인 업체 DNS 에 등록
2. `APP_PUBLIC_BASE_URL` 을 새 도메인으로 갱신
3. **`frontend/public/sitemap.xml` 의 `<loc>` 48개를 절대 URL 로 치환** (현재는 `/convert` 같은 상대 경로)
4. **`frontend/public/robots.txt` 의 `Sitemap:` 줄을 절대 URL 로 치환** (사이트맵 지시자는 상대 경로를 허용하지 않는다)
5. 2단계(SPA 재빌드)부터 다시 수행 — public/ 파일 변경은 빌드를 거쳐야 static 에 반영된다
6. 구글 서치콘솔·네이버 서치어드바이저에 sitemap 제출

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 배포는 성공했는데 **사이트가 빈 화면** | `static/` 이 비었거나 오래됨 (2단계 누락) | `./gradlew copyFrontendBuild` 후 재배포 |
| **특정 도구 URL 만 403** | `SecurityConfig` permitAll 목록 누락 | `SecurityConfig` + `HomeController` 둘 다에 경로 추가. 두 테스트로 검증 |
| 기동 직후 **fail-fast 종료** | `APP_PUBLIC_BASE_URL` 미설정 또는 localhost | Railway 변수에 실제 URL 설정 (`RailwayDeploymentValidator` 의 의도된 동작) |
| `./gradlew test` 가 **EPERM** 으로 실패 | Vite 개발 서버가 파일을 잠금 | 개발 서버 종료 또는 `-x frontendInstall …` |
| `npm ci` 가 lock 불일치로 실패 | `package.json` 만 고치고 lock 갱신 안 함 | 로컬에서 `npm install` 후 `package-lock.json` 도 커밋 |
| 새로고침하면 404 | `HomeController` 에 라우트 없음 | `@GetMapping` 목록에 추가 |

> ⚠️ **`npm audit fix --omit=dev` 는 쓰지 말 것** — devDependencies(vite·vitest)를 지워 버려
> 빌드가 통째로 깨진다. 실제로 겪었다.

---

## 참고

- Dockerfile 상단 주석의 `total_module` / `total_설계/…` 경로는 **이 저장소에 존재하지 않는다**
  (상위 통합 저장소를 전제로 쓰인 문장). 현재는 이 Dockerfile 이 실제 배포에 쓰인다.
- 배포 전 조건·프로젝트 규칙: 루트 `README.md`
- 지금 무엇이 배포되는지: `설계/03_도구카탈로그.md`
