# businesscard_qr 배포 준비 점검 (2026-07-15)

> businesscard_qr을 Railway에 올리기 전 준비상태 점검. (이미 Gradle 모듈 편입 + 버킷 마이그레이션 완료, master에 있음)
> **결론: 코드 blocker 1개(MySQL 드라이버) 해결 후, doll_gacha와 거의 동일한 절차로 배포 가능.**
> 배포 절차 표준: [`total_설계/railway_배포_및_비용.md`](../total_설계/railway_배포_및_비용.md)

---

## 🚨 배포 전 반드시 해결 — MySQL 드라이버 부재 (유일한 코드 blocker)

- **위치**: `businesscard_qr/build.gradle` (runtimeOnly 의존성)
  ```gradle
  runtimeOnly 'com.h2database:h2'
  runtimeOnly 'org.mariadb.jdbc:mariadb-java-client'
  // ← com.mysql:mysql-connector-j 가 없음
  ```
- **문제**: datasource를 `jdbc:mysql://total_mysql...`로 붙일 텐데, MySQL 드라이버가 classpath에 없어 부팅 시 **`Cannot load driver class: com.mysql.cj.jdbc.Driver`** → Hikari 초기화 실패 → 앱이 안 뜸.
  - `application.yml`은 `driver-class-name: ${SPRING_DATASOURCE_DRIVER:}`(비우면 URL로 자동추론)이라, `jdbc:mysql://`면 자동으로 `com.mysql.cj.jdbc.Driver`를 고르는데 그게 없음.
  - MariaDB Connector/J(3.x)는 `jdbc:mysql://` 스킴을 **기본 거부** → 자동 대체도 안 됨.
- **해결 (권장 = doll_gacha와 동일하게 1줄 추가)**:
  ```gradle
  runtimeOnly 'com.mysql:mysql-connector-j'
  ```
  → 그러면 문서의 `jdbc:mysql://` 템플릿을 그대로 사용.
- (대안, 비추) 코드 수정 없이 env로 `jdbc:mariadb://` 스킴 + `SPRING_DATASOURCE_DRIVER=org.mariadb.jdbc.Driver` + `permitMysqlScheme` 우회 — MySQL 전용 파라미터(`allowPublicKeyRetrieval`, `serverTimezone` 등)를 MariaDB 드라이버가 거부할 수 있어 파라미터 정리 필요. 지저분함.

> doll_gacha는 `runtimeOnly 'com.mysql:mysql-connector-j'`가 이미 있음. 두 모듈 드라이버 구성이 달랐던 것.

---

## Railway에 넣을 env (application.yml 기준, 정확한 이름)

> ⚠️ doll_gacha와 **env 이름이 다름** 주의.

**DB (필수)**
- `SPRING_DATASOURCE_URL` = `jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/businesscard?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&createDatabaseIfNotExist=true`
  - (드라이버 옵션 A 전제. 공통 `total_mysql`의 `businesscard` 스키마. `createDatabaseIfNotExist=true`로 스키마 자동 생성)
- `SPRING_DATASOURCE_USERNAME` = `${{total_mysql.MYSQLUSER}}`
- `SPRING_DATASOURCE_PASSWORD` = `${{total_mysql.MYSQLPASSWORD}}`

**인증 / URL / CORS**
- `APP_JWT_SECRET` = `<랜덤 긴 문자열>` — **필수(fail-fast).** `openssl rand -base64 48`
- `APP_PUBLIC_BASE_URL` = `https://<이 서비스 도메인>` — 권장(없으면 경고. QR/이미지 절대 URL 기준)
- `APP_CORS_ALLOWED_ORIGINS` = `<운영 프론트/웹 도메인들>` — 기본값이 localhost 뿐이라 웹 클라이언트 있으면 필요(콤마 구분). 네이티브 앱만이면 불필요.

**버킷 (필수 — 실제 값 직접 입력, 참조 금지)**
- `BUCKET_ENDPOINT` / `BUCKET_ACCESS_KEY_ID` / `BUCKET_SECRET_ACCESS_KEY` / `BUCKET_NAME` (businesscard 전용 버킷 화면 값), `BUCKET_REGION=auto`

**런타임**
- `APP_MODULE=businesscard_qr` (명시 권장)

**넣지 않아도 되는 것 (doll_gacha와 다름!)**
- ❌ `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / 카카오 Redirect URI — **불필요.** businesscard_qr은 서버 OAuth2 리다이렉트가 아니라, 앱이 카카오 access token을 `/api/auth/kakao`로 보내면 서버가 카카오 API로 **검증만** 하는 방식. (선택: `APP_KAKAO_EXPECTED_APP_ID`로 발급 앱 제한 가능)
- ❌ `SPRING_PROFILES_ACTIVE=prod` — 이 모듈은 **prod 프로파일 파일이 없음**(env-only). 넣어도 무해하나 불필요.

---

## fail-fast (RailwayDeploymentValidator) — 하나라도 빠지면 부팅 차단

`RAILWAY_PROJECT_ID`(Railway 자동 주입) 있을 때만 발동:
1. `APP_JWT_SECRET` ≠ 소스 기본값
2. `SPRING_DATASOURCE_URL` 세팅 & `jdbc:h2` 아님 (H2 부팅 차단)
3. `BUCKET_ENDPOINT` 비어있지 않음
4. `BUCKET_NAME` + `BUCKET_ACCESS_KEY_ID` + `BUCKET_SECRET_ACCESS_KEY` 모두 채워짐
5. `APP_PUBLIC_BASE_URL` 비면 경고만(실패 아님)

> ⚠️ 버킷 값을 `${{...}}` 참조로 넣으면 빈 값이 되어 3·4에서 걸림 → **화면 값 직접 복사.**

---

## 확인된 것 (doll_gacha와 동일 패턴)

- **파일 저장**: `card/storage/FileStorageConfig.java` — `BUCKET_ENDPOINT` 있으면 `BucketFileStorage`(S3, path-style), 없으면 로컬 디스크 폴백. env 이름 동일(`BUCKET_*`). private 버킷 서빙 `GET /uploads/**` permitAll.
- **/healthz**: `StatusController` → `{"service":"businesscard_qr","status":"UP"}`, permitAll → Railway 헬스체크 정상.
- **빌드**: 루트 단일 Dockerfile이 `:businesscard_qr:bootJar`로 빌드, start.sh가 `APP_MODULE`로 선택(allow-list 포함), `-Xmx384m` 기본 적용.
- 클라이언트: **Flutter 앱**(화면 없는 순수 REST API). 확인은 `/swagger-ui.html`로.

---

## 배포 순서 (체크리스트)

- [ ] **① `build.gradle`에 `runtimeOnly 'com.mysql:mysql-connector-j'` 추가** (blocker) → 커밋/푸시
- [ ] ② `businesscard` 전용 **버킷 생성** → S3 자격증명 확보
- [ ] ③ Railway 앱 서비스 생성(Repo=total_module, master, Root/Build/Start 비움, Healthcheck `/healthz`)
- [ ] ④ env 입력 (위 목록 — datasource `/businesscard`, `APP_JWT_SECRET`, `APP_PUBLIC_BASE_URL`, `BUCKET_*`)
- [ ] ⑤ Generate Domain → Deploy → `/healthz` UP + `/swagger-ui.html` 확인
- [ ] ⑥ **App Sleeping ON** (Hard limit은 워크스페이스 공통이라 이미 적용)
- [ ] ⑦ Flutter 앱 base URL을 이 서비스 도메인으로 (`.env`의 `BACKEND_BASE_URL`)

> ①만 하면 나머지는 doll_gacha에서 겪은 것과 사실상 동일. 드라이버 결정 후 바로 진행 가능.
