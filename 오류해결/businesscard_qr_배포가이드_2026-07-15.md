# businesscard_qr 배포 가이드 — "내가 할 것" 중심 (2026-07-15)

> businesscard_qr(Spring Boot, 화면 없는 REST API)를 Railway에 올리는 **실행 절차**.
> 일반 절차는 [`total_설계/railway_배포_및_비용.md`](../total_설계/railway_배포_및_비용.md)에 있지만, **이 문서는 businesscard_qr 전용**이라 doll_gacha와 다른 점·실제 넣을 값까지 다 적었다.
> 원칙: **같은 코드가 로컬(H2)에서도 운영(MySQL+버킷)에서도 그대로 동작** ([`코드컨벤션.md`](../total_설계/코드컨벤션.md) §5).

---

## 0. 코드 상태 — ✅ 준비 끝 (내가 할 것 없음)

| 항목 | 상태 |
|---|---|
| **MySQL 드라이버** | ✅ **해결됨** — `build.gradle`에 `com.mysql:mysql-connector-j` 추가 (안 쓰는 `mariadb-java-client` 제거). 이제 `jdbc:mysql://`로 붙음 |
| **배포 전 코드 점검** | ✅ 완료 — 발견된 보안/데이터 이슈 4개 수정 (아래) |
| ├ 카카오 발급앱 검증 | ✅ **`APP_KAKAO_EXPECTED_APP_ID` 미설정 시 부팅 차단**으로 강제 (전엔 조용히 skip → 인증 우회 가능했음) |
| ├ refresh 토큰 오용 | ✅ 인증 필터가 **`typ=access` 만 통과**시킴 (전엔 refresh 토큰(14일)으로 API 사용 가능) |
| ├ 이미지 교체 유실 | ✅ **새 이미지 저장·DB갱신 성공 후 옛 이미지 삭제** (전엔 먼저 지워서 실패 시 원본 영구 유실) |
| └ 버킷 I/O 트랜잭션 | ✅ **버킷 호출을 트랜잭션 밖으로** (코드컨벤션 §1 — 커넥션 풀 고갈 방지) |
| IDOR | ✅ 없음 — 전 경로가 소유자 스코프 쿼리(`findByIdAndUserIdAndIsActiveTrue`) |
| 환경 무관 실행 | ✅ 준수 — 코드에 `if(prod)` 분기 없음. 모든 설정이 `${ENV:로컬기본값}` 패턴 |
| 로컬 동작 | ✅ `:businesscard_qr:test` 통과 (H2 인메모리) |
| 파일 저장 | ✅ 버킷(S3) + 로컬 디스크 폴백 (doll_gacha와 동일 구조) |
| 헬스체크 | ✅ `GET /healthz` → `{"service":"businesscard_qr","status":"UP"}` |
| Swagger | ✅ `/swagger-ui.html` (공개) |

> ⚠️ 이 코드 변경(드라이버)은 **master에 push돼 있어야** Railway가 빌드한다. (배포 전 커밋·push 확인)

---

## 1. 내가 준비할 것 (배포 전)

| 준비물 | 어디서 / 어떻게 |
|---|---|
| **JWT 시크릿** | 직접 생성. **32byte 이상.** 예: `openssl rand -base64 48` (소스 기본값 쓰면 부팅 차단됨) |
| **카카오 앱 ID** ⭐**필수** | 카카오 개발자 콘솔 → 내 애플리케이션 → **앱 ID(숫자)**. **미설정 시 부팅 차단**(fail-fast) — 없으면 **다른 카카오 앱이 발급한 토큰으로도 로그인이 뚫린다**(인증 우회) |

> ✅ **카카오 CLIENT_ID/SECRET, Redirect URI는 필요 없다** (doll_gacha와 다름 — 아래 §5 참고). 필요한 건 **앱 ID 하나뿐**.

---

## 2. 버킷 만들기 (파일 저장)

1. Railway → `+ New` → **Bucket** → 이름 `businesscard_bucket`
2. 만든 버킷 열면 **S3-compatible Credentials** 5개 값이 보임 → **그대로 복사해둔다**(§4에서 씀):
   - Endpoint URL / Access Key ID / Secret Access Key / **Bucket Name(자동 생성된 실제 이름)** / Region

> ⚠️ **버킷 값은 `${{...}}` 참조가 안 된다.** 화면 값을 **직접 복사**해서 넣어야 함. (참조로 넣으면 빈 값 → 부팅 실패)

---

## 3. 서비스 만들기

1. Railway → `+ New` → `Service` → **GitHub Repo** → `gks930620/total_module`
2. 서비스 이름을 **`businesscard_qr`** 로 변경
3. `Settings` 확인:
   - Branch **`master`**
   - **Root Directory 비움(`/`)** ← ⚠️ `/businesscard_qr`로 바꾸지 말 것! 루트 Dockerfile이 전 모듈을 빌드하고, **어느 모듈을 띄울지는 `APP_MODULE`로 고른다**
   - Build/Start Command **비움**
   - Healthcheck Path **`/healthz`**
4. `Settings → Networking → **Generate Domain`** → 생성된 도메인 메모 (예: `businesscardqr-production.up.railway.app`) → §4의 `APP_PUBLIC_BASE_URL`에 사용

---

## 4. 환경변수 입력 (businesscard_qr 서비스 → Variables)

```env
APP_MODULE=businesscard_qr

# DB — 공통 total_mysql 의 businesscard 스키마 (createDatabaseIfNotExist 로 스키마 자동 생성)
SPRING_DATASOURCE_URL=jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/businesscard?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&createDatabaseIfNotExist=true
SPRING_DATASOURCE_USERNAME=${{total_mysql.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{total_mysql.MYSQLPASSWORD}}

# 인증 — ⚠️ 이름이 doll_gacha 와 다름
APP_JWT_SECRET=<랜덤 32byte 이상 문자열>
APP_PUBLIC_BASE_URL=https://<3에서 생성한 도메인>

# 파일 버킷 — ⚠️ 참조 아님! §2 버킷 화면의 실제 값 직접 입력
BUCKET_ENDPOINT=https://t3.storageapi.dev
BUCKET_ACCESS_KEY_ID=<버킷 Access Key ID (tid_...)>
BUCKET_SECRET_ACCESS_KEY=<버킷 Secret Access Key (tsec_...)>
BUCKET_NAME=<버킷 화면의 실제 Bucket Name>
BUCKET_REGION=auto

# 카카오 토큰 "발급 앱" 검증 — ⭐필수 (미설정 시 부팅 차단. 인증 우회 방지)
APP_KAKAO_EXPECTED_APP_ID=<카카오 앱 ID(숫자)>
```

**넣지 않는 것** (doll_gacha와 다름):
- ❌ `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` / Redirect URI — **불필요** (§5)
- ❌ `SPRING_PROFILES_ACTIVE=prod` — 이 모듈은 **prod 프로파일 파일이 없다**(env로만 설정). 넣어도 무해하나 의미 없음
- △ `APP_CORS_ALLOWED_ORIGINS` — **네이티브 앱만 쓰면 불필요**(CORS는 브라우저 전용). 웹 클라이언트 붙일 때만 추가

> ⚠️ **fail-fast**: `APP_JWT_SECRET`(기본값 아님) · `SPRING_DATASOURCE_URL`(H2 아님) · `BUCKET_ENDPOINT` · `BUCKET_NAME`+`ACCESS`+`SECRET` · **`APP_KAKAO_EXPECTED_APP_ID`** 중 하나라도 빠지면 **부팅 자체가 실패**한다(의도된 동작). 로그에 뭐가 빠졌는지 한글로 나옴.

> 🚨 **주소 3개가 반드시 같아야 한다 — 제일 실수하기 쉬운 지점**
> ```
> ① Railway 가 실제 생성한 도메인      (§3 Generate Domain 결과)
> ② 앱 .env 의 BACKEND_BASE_URL        (businesscard_qr_app/.env)
> ③ 서버 env 의 APP_PUBLIC_BASE_URL    (여기 §4)
> ```
> - **① ≠ ②** → 앱이 **전 API 실패**. 서비스를 새로 만들면 도메인이 예전과 **다를 수 있으니**, Generate Domain 후 앱 `.env` 값과 **반드시 대조**할 것.
>   (현재 앱은 `https://businesscardqr-production.up.railway.app` 을 바라보고 있음 — `.env` + `api_config.dart` 기본값 둘 다)
> - **③ 누락/불일치** → ⚠️ **조용히 깨진다**: 서버가 이미지·QR·다운로드 **절대 URL을 `APP_PUBLIC_BASE_URL` 기준으로 생성**하는데, 이 값은 비어 있어도 **fail-fast 아니라 warn만** 하고 부팅은 성공한다.
>   → **`/healthz`는 UP인데 이미지·QR만 엉뚱한 주소**가 되는 함정. 반드시 채우고 ①②와 같게 맞출 것.

---

## 5. doll_gacha와 다른 점 (헷갈리기 쉬움)

| | doll_gacha | **businesscard_qr** |
|---|---|---|
| 화면 | React 정적 서빙 | **없음(순수 REST API)** → 확인은 `/swagger-ui.html` |
| 클라이언트 | 브라우저 | **Flutter 앱** |
| 로그인 방식 | 서버 OAuth2 **리다이렉트**(카카오·구글) | **앱이 카카오 토큰을 보내면 서버가 검증만** → **CLIENT_ID/SECRET·Redirect URI 불필요** |
| JWT env 이름 | `JWT_SECRET_KEY` | **`APP_JWT_SECRET`** |
| base URL env | `APP_BASE_URL` | **`APP_PUBLIC_BASE_URL`** |
| prod 프로파일 | `application-prod.yml` 있음 | **없음** (env로만) |
| 버킷 | `doll_gacha_bucket` | `businesscard_bucket` |
| DB 스키마 | `/doll_gacha` | **`/businesscard`** (같은 total_mysql) |

---

## 6. 배포하고 확인 — 앱 없이 여기까지 검증 가능 ⭐

Deploy 후 **브라우저만으로** 다음 3개를 확인한다. 이게 통과하면 "배포 잘 됨"으로 봐도 된다.

**① 헬스체크 (제일 중요)**
```
https://<도메인>/healthz  →  {"service":"businesscard_qr","status":"UP"}
```
- UP이면 **부팅 성공 = DB 연결 + JWT + 버킷 env 전부 정상**이 증명된다. (fail-fast라 하나라도 틀리면 앱이 안 뜸)

**② Swagger (공개라 로그인 없이 열림)**
```
https://<도메인>/swagger-ui.html
```
- 엔드포인트 목록이 뜨면 API가 실제로 서빙 중. **Try it out**으로 호출도 가능.

**③ 인증 엔드포인트에 토큰 없이 호출 → 401 나와야 정상**
- 예: Swagger에서 `GET /api/business-cards` 를 토큰 없이 → **401**. (500이면 문제)
- → 보안 필터·예외처리가 제대로 붙었다는 증거.

> **토큰 필요한 흐름(로그인·명함 CRUD)** 은 카카오 access token이 있어야 해서 브라우저만으론 번거롭다. → **앱이 자연스러운 테스트 클라이언트**. (앱에서 한 번 로그인해 JWT를 얻으면 Swagger **Authorize**에 붙여넣어 전 API를 브라우저에서 테스트도 가능)

**④ App Sleeping ON**: `Settings → Serverless` 토글 (트래픽 없으면 재워서 비용↓, 첫 요청 10~30초 콜드스타트)

---

## 7. 다 되면 — 앱 연결 (나중 단계)

- Flutter 앱(`businesscard_qr_app`)의 base URL을 이 서비스 도메인으로:
  - `.env`의 **`BACKEND_BASE_URL`** = `https://<도메인>`
- 앱에서 **카카오 로그인 → 명함 생성/조회/QR/이미지 업로드** 확인
- 이미지가 **재배포 후에도 보이는지**(버킷 저장 확인)

---

## 8. 문제 시 볼 것

| 증상 | 확인 |
|------|------|
| 부팅 실패 + `Cannot load driver class: com.mysql.cj.jdbc.Driver` | 드라이버 커밋이 master에 push됐는지 (§0) |
| 부팅 실패 + 한글 fail-fast 메시지 | 빠진 env — `APP_JWT_SECRET`/datasource/`BUCKET_*` (§4) |
| 부팅 실패 + `버킷 ... 비어 있습니다` | 버킷을 `${{...}}` 참조로 넣음 → **실제 값 직접 입력**으로 (§2) |
| 부팅 실패 + DB `Connection refused` | `total_mysql` Running인지, 참조 서비스명이 맞는지 |
| `/healthz`는 UP인데 앱에서 로그인 실패 | 앱 base URL(`BACKEND_BASE_URL`)이 이 도메인인지, 카카오 네이티브 키 설정 |
| 이미지 업로드/표시 실패 | `BUCKET_*` 실제 값인지, `BUCKET_NAME`이 자동 생성명인지 |

---

## 9. 나중 과제 — 알고 있고, 지금은 의도적으로 안 고친 것

### 🔓 Swagger 운영 공개 ← **나중에 제일 먼저 다시 볼 것**
- 현재 `/swagger-ui.html` · `/v3/api-docs/**` 가 **인증 없이 공개**(`SecurityConfig.java`). 프로파일/env 게이트 없음.
- **지금 의도적으로 열어둔 이유**: ① 배포 검증(§6)이 swagger에 의존 ② 운영에서도 API 확인용으로 쓸 예정.
- **위험**: 전체 API 스펙·파라미터·DTO 구조가 외부에 노출(공격 표면 정찰). 게이트웨이가 없어 **서비스 URL = 공개 URL**이라 그대로 열림.
- **나중에 고칠 때 선택지 (쉬운 순)**:
  1. **env로 끄기** — 코드 수정 없이 즉시: `SPRINGDOC_API_DOCS_ENABLED=false`, `SPRINGDOC_SWAGGER_UI_ENABLED=false`
  2. **인증 걸기** — `SecurityConfig`에서 swagger 경로를 `authenticated()` 로 (또는 basic auth)
  3. **운영에서만 비활성** — prod 설정에 `springdoc.api-docs.enabled: false`

### 그 외 기록만 (영향 낮음, 급하지 않음)
- **`/uploads/**` 공개 → 5분 다운로드 토큰이 실효 없음**: 이미지 바이트를 토큰·만료 없이 상시 받을 수 있어, 토큰 플로우가 보안상 추가하는 게 없다. (QR 공유 서비스라 capability URL로 의도된 면도 있음 — 파일명이 UUID+밀리초라 열거는 어려움)
- **요청 필드 길이 검증(`@Size`) 없음** → 컬럼 초과 입력 시 400이 아니라 **409**로 나감
- **명함 목록 페이징 없음** — 사용자당 카드 수가 적어 실위험 낮음 (`PageResponse` DTO는 만들어져 있으나 미사용)
- **`view-count` 무인증·무제한** — QR 스캐너용 공개는 의도. 레이트리밋/중복제거가 없어 조회수 조작·비용 남용 여지 (카운터 동시성 자체는 원자적 UPDATE로 정상)
- **CORS** — validator가 `APP_CORS_ALLOWED_ORIGINS`를 검사 안 함 → 웹 클라이언트 붙일 때 조용히 CORS 실패 가능. `*`를 넣으면 `allowCredentials(true)`와 충돌해 **요청 시점에** 런타임 오류
- **다운로드 토큰이 쿼리스트링**에 실림 — 액세스 로그·Referer에 잔류 (TTL 5분 + UUIDv4라 위험 낮음)

---

## 요약 — 내가 할 일 순서
1. (코드) **드라이버 수정분 커밋·push** ✅ 준비됨
2. **버킷** `businesscard_bucket` 생성 → 자격증명 5개 복사
3. **서비스** 생성 (repo/master/Root `/`/healthcheck `/healthz`) → **Generate Domain**
4. **env 입력** (§4 — `APP_MODULE`, datasource `/businesscard`, `APP_JWT_SECRET`, `APP_PUBLIC_BASE_URL`, `BUCKET_*` 5개)
5. **Deploy → ①healthz ②swagger ③401 확인** → **App Sleeping ON**
6. (나중) 앱 `BACKEND_BASE_URL` 연결 → 로그인/CRUD 확인
