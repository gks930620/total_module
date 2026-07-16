# Railway 배포 & 비용 가이드 (total_module)

> total_module의 **모든 Railway 작업**(배포 절차·환경변수·DB·파일저장·비용 절감·도메인·문제해결)을 한 문서로.
> 통합정리: 2026-07-14 (기존 4개 문서 통합). 아키텍처/편입은 → [`아키텍처_및_편입기준.md`](아키텍처_및_편입기준.md), 코드규칙 → [`코드컨벤션.md`](코드컨벤션.md)
> 대상: **사용자가 Railway 대시보드에서 직접** 하는 작업(코드/빌드는 준비됨).

---

## 0. 미래의 나에게 — 자주 헷갈리는 점 (전부 의도된 결정)

Railway를 열어보고 "어? 잘못한 거 아냐?" 싶을 때 먼저 볼 것:

| 볼 때 드는 의문 | 답 (의도된 결정) |
|---|---|
| **"왜 MySQL이 1개뿐? 서비스별로 분리 안 했네?"** | **일부러 통합.** DB를 모듈마다 만들면 인스턴스 비용이 개수만큼 붙는다(각 ~$2). 대신 **MySQL 1개 안에서 database(스키마)로 분리**(`doll_gacha`,`businesscard_qr` — **스키마명 = 모듈명**) → 테이블 충돌은 없애고 비용은 1개. → §4 |
| **"왜 앱 첫 접속이 20~30초 느려?"** | **App Sleeping(서버리스)** 켜서. 트래픽이 거의 없어 안 쓸 땐 재워 RAM비를 0으로, 요청 오면 깨움. 콜드스타트는 그 대가. → §6 |
| **"왜 하나의 Spring Boot로 안 합치고 서비스 여러 개?"** | 모듈러 모놀리스가 더 싸지만 **시큐리티(JWT vs OAuth2) 병합 난이도가 커서** 지금은 안 함. App Sleeping+DB통합으로 비용을 잡음. → §6 |
| **"버킷은 왜 프로젝트별로 따로야?"** | 버킷 요금은 **개수가 아니라 총 용량(GB)** 기준이라 여러 개여도 요금 안 오름 → 격리 위해 분리가 정석. (DB와 반대) → §5 |
| **"businesscard가 왜 꺼져 있어?"** | 안 써서 **일부러 Remove**(비용). Redeploy로 부활, 설정·데이터 보존. |
| **"요금 왜 이래?"** | Spring Boot(JVM)는 **트래픽 0이어도 RAM 상시 점유** → 앱 1개 24시간 ≈ $5. 이상 아님. → §6 |

> ⚠️ **"DB 1개·앱 느린 첫 응답·서비스 여러 개"는 전부 비용 최적화를 위한 의도된 선택.** 되돌리지 말 것.

---

## 1. 한 장 요약

```
저장소 1개 = Railway 프로젝트 1개
빌드: 루트 단일 Dockerfile → 이미지 1개 (모든 모듈 jar)
실행: 모듈 = 서비스 (APP_MODULE로 선택), 헬스체크 /healthz
접근: 각 서비스 자기 공개 URL 직행 (게이트웨이 없음)
DB:   공통 MySQL 1개 + 모듈별 스키마
파일: 모듈별 Storage Bucket (S3 호환)
비용: App Sleeping + JVM 메모리 상한(-Xmx384m) + Hard limit $5
```

---

## 2. 배포 절차 (처음부터)

### 시작 전 규칙
1. env 값에 따옴표(`"`) 넣지 않기(넣어도 start.sh가 벗겨줌).
2. `<...>` 예시는 실제 값으로.
3. 모든 모듈 서비스는 같은 저장소를 사용. Root Directory 비움, Build/Start Command 비움(루트 Dockerfile이 처리).

### 2-1. 프로젝트 + 공통 MySQL (최초 1회)
1. `New Project → Empty Project` (이름 예 `total_module`)
2. `+ New → Database → MySQL` → 이름 **`total_mysql`** → `Variables`에 `MYSQL*` 자동 생성 확인
   > ⚠️ 이 자동 변수(`MYSQLHOST` 등)를 **삭제 금지.** 지우면 참조가 빈 값→`Connection refused`. (잘못 지웠으면 같은 이름으로 DB 재생성이 가장 깔끔.)
3. 모듈 database(스키마) 생성 — §4

### 2-2. 앱 서비스 (모듈마다 반복)

> ⚠️ **Railway엔 "어느 모듈이냐" 폴더 선택 항목이 없다.** Root Directory는 `/`(레포 전체 → 루트 Dockerfile이 **전 모듈 jar를 다 빌드**해 이미지 1개에 담음). **어느 모듈을 띄울지는 `APP_MODULE` 환경변수로 고른다**(예: `APP_MODULE=doll_gacha`). Root를 `/doll_gacha`로 바꾸는 게 아니다 — 모든 모듈 서비스가 같은 레포·같은 Dockerfile을 쓰고 `APP_MODULE`만 다르다. (근거: [`아키텍처_및_편입기준.md`](아키텍처_및_편입기준.md) §2)

1. `+ New → Service → GitHub Repo → total_module`
2. 서비스 이름을 모듈명(예 `doll_gacha`)으로
3. `Settings`: Branch `master`, **Root Directory 비움(=`/`)**, Build/Start Command 비움, Healthcheck `/healthz`
4. `Networking → Generate Domain` → 도메인 메모(예 `dollgacha-production.up.railway.app`) → base URL env에 사용
5. `Variables` 입력 (§3)
6. (파일 업로드 모듈이면) Storage Bucket 생성 (§5)
7. Deploy → 런타임 로그에서 `HikariPool Start completed` → `Started ...App` → `/healthz` UP 확인
8. (권장) App Sleeping ON + Hard limit (§6)

---

## 3. 환경변수

### 3-1. 사람이 미리 준비할 것 (코드가 모름)
| 준비물 | 어디서 |
|----|----|
| **JWT 시크릿** | 직접 생성 (`openssl rand -base64 48`). 소스 기본값이면 배포 차단 |
| **OAuth CLIENT_ID/SECRET** (소셜 로그인 모듈) | 카카오/구글 개발자 콘솔 |
| **공개 도메인** | Railway Generate Domain 값(또는 커스텀) → base URL·OAuth redirect에 사용 |
| **버킷 자격증명** (파일 모듈) | Railway Bucket 화면 값(§5) |

### 3-2. 서비스 env 템플릿 (모듈이 쓰는 것만)
```env
# 공통 필수
APP_MODULE=<module>
SPRING_PROFILES_ACTIVE=prod

# DB (§4) — 공통 MySQL 참조 + database 는 이 모듈 스키마(/<module>)로 고정
#   · /<module> 가 이 모듈 전용 스키마. createDatabaseIfNotExist=true → 앱이 없을 때 자동 생성(SQL 불필요)
#   · ${{total_mysql.*}} 는 입력창에 ${{ 치면 나오는 자동완성으로 넣기(오타 방지). MySQL 서비스명이 다르면 그 이름으로.
SPRING_DATASOURCE_URL=jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/<module>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&createDatabaseIfNotExist=true
SPRING_DATASOURCE_USERNAME=${{total_mysql.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{total_mysql.MYSQLPASSWORD}}

# 공개 base URL — 모듈마다 env 이름 다를 수 있음(APP_BASE_URL / APP_PUBLIC_BASE_URL)
APP_BASE_URL=https://<이 서비스 도메인>

# 인증/OAuth (쓰는 모듈만)
JWT_SECRET_KEY=<랜덤 긴 문자열>
KAKAO_CLIENT_ID=<...>
KAKAO_CLIENT_SECRET=<...>
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>

# 파일 저장 버킷 (§5) — ⚠️ 참조 아님! 버킷 화면의 실제 값 직접 입력
BUCKET_ENDPOINT=https://t3.storageapi.dev
BUCKET_ACCESS_KEY_ID=<버킷 Access Key ID (tid_...)>
BUCKET_SECRET_ACCESS_KEY=<버킷 Secret Access Key (tsec_...)>
BUCKET_NAME=<버킷 화면의 실제 Bucket Name>
BUCKET_REGION=auto
```
> ⚠️ 필수 env(datasource·JWT·OAuth·`SPRING_PROFILES_ACTIVE=prod`·base URL·`BUCKET_*`)가 빠지거나 base URL이 localhost면 **부팅 실패**(fail-fast). 로그에 빠진 값이 한글로 나온다.
> **입력 방식 2가지**: DB는 `${{서비스명.변수}}` **참조**(자동완성), 버킷은 화면 값 **직접 복사**(참조 미지원).

---

## 4. DB — 공통 MySQL 1개 + 스키마 분리

> "DB 서비스는 1개, 그 안 database(스키마)를 모듈별로 나눈다." user별이 아니라 **database 단위**.

```
MySQL 서비스 1개 (total_mysql)
├─ database: doll_gacha    (user, doll_shop, ...)
└─ database: businesscard_qr  (app_users, business_cards, ...)
```
→ `doll_gacha.user` 와 `businesscard.user`는 다른 네임스페이스 → **테이블 충돌 없음.** (예전 "DB 분리" 요구가 스키마 분리로 충족되면서 인스턴스는 1개 = 비용↓)

> **실제로 할 일은 2가지뿐** — ⑴ `total_mysql` 서비스 1개 만들기, ⑵ 각 앱 datasource의 database를 `/<module>`로. database(스키마) 자체는 안 만들어도 됨(아래 기본 방식).

**절차 (모듈마다)**
1. 공통 MySQL 서비스는 **1개(`total_mysql`)** 만 둔다. (없으면 §2-1로 1회 생성)
2. 그 모듈 앱 서비스 `Variables`에서 datasource 3개를 **공통 MySQL 참조 + `/<module>` 스키마**로:
   ```
   SPRING_DATASOURCE_URL=jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/<module>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&createDatabaseIfNotExist=true
   SPRING_DATASOURCE_USERNAME=${{total_mysql.MYSQLUSER}}
   SPRING_DATASOURCE_PASSWORD=${{total_mysql.MYSQLPASSWORD}}
   ```
   - **기본(권장)**: URL 끝 **`createDatabaseIfNotExist=true`** → 앱이 뜰 때 `<module>` database를 **자동 생성**(root 권한이라 동작). **접속해서 SQL 칠 필요 없음.**
   - (대안) 수동으로 미리 만들고 싶으면 MySQL에 접속해:
     `CREATE DATABASE IF NOT EXISTS <module> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. 저장 → 재배포. 스키마 안의 테이블은 앱이 `ddl-auto`로 생성.

> 예) doll_gacha → `/doll_gacha`, businesscard_qr → `/businesscard_qr`. **스키마명 = 모듈명**. 같은 `total_mysql`, database 이름만 다름 → 인스턴스 1개, 스키마로 분리.

---

## 5. 파일 저장 — Storage Bucket (S3 호환)

> 컨테이너 디스크는 재배포 시 사라지므로 파일은 버킷에. 기준: [`코드컨벤션.md`](코드컨벤션.md) §5-3. **버킷은 모듈별 1개**(`<module>_bucket`).

1. `+ New → Bucket` → 이름 `<module>_bucket`
2. 버킷 화면의 **S3 자격증명을 §3 env에 직접 복사**:

| 버킷 화면 | 넣을 env |
|----|----|
| Endpoint URL | `BUCKET_ENDPOINT` (예 `https://t3.storageapi.dev`) |
| Access Key ID | `BUCKET_ACCESS_KEY_ID` (tid_...) |
| Secret Access Key | `BUCKET_SECRET_ACCESS_KEY` (tsec_...) |
| Bucket Name | `BUCKET_NAME` (자동 생성명, 예 `dollgachabucket-ab12`) |
| Region | `BUCKET_REGION` (`auto`) |

> ⚠️ **버킷에서 크게 헤맸던 3가지**
> 1. **참조 변수 없음** — Railway 버킷은 `${{버킷.변수}}` 미제공. 위 값을 **직접 복사**(참조로 넣으면 빈 값→"endpoint 비어있음"으로 부팅 실패).
> 2. **`BUCKET_NAME`은 내가 지은 이름이 아니라** Railway 자동 생성 **실제 버킷명**.
> 3. **"Add to Service" 버튼 금지** — 다른 이름(`AWS_*`)으로 주입돼 또 빈 값. 위 이름으로 수동 입력.
>
> private 버킷이라 공개 URL 없음. 앱이 `GET /uploads/{키}`로 프록시 서빙(프론트 수정 0).

---

## 6. 비용 최적화 ⭐

### 6-1. 비용의 정체
```
월 비용 ≈ (JVM 베이스 RAM ~$5) × (앱 서비스 개수) + (MySQL ~$2) × (DB 개수)
```
- **JVM 세금**: Spring Boot는 코드가 10줄이든 1000줄이든 JVM+Context+Tomcat+Hibernate로 **~0.5GB RAM 상시 점유**. Railway RAM ≈ $10/GB·월 → **앱 1개 24시간 = 그 자체로 ~$5**. 트래픽 0이어도 "켜져 있다는 사실만으로" 과금.
- Railway엔 매달 공짜 플랜 없음(Trial=일회성 $5). Hobby $5/월 = "구독+사용량 $5 포함"이라 **상시 앱1+DB1이면 이미 $5 초과 쉬움**.
- → **곱셈 인자(서비스 수·DB 수)를 줄이는 게 해법.**

### 6-2. 이 프로젝트의 선택 (App Sleeping + 메모리 + DB통합)
| 방법 | 어떻게 | 효과 |
|---|---|---|
| **App Sleeping** | 각 앱 Settings → **Serverless/App Sleeping ON** | idle 시 컴퓨트 ≈0. 단 **JVM 콜드스타트 10~30초**, DB는 안 잠 |
| **JVM 메모리** | 이미 **Dockerfile에 `-Xmx384m` 기본 적용**(재배포만) | RAM ~500→~350MB. 서비스별 `JAVA_OPTS`로 조정, OOM 시 512m |
| **DB 통합** | 공통 MySQL 1개 + 스키마(§4) | DB 비용 N→1 (App Sleeping이 DB는 못 재우니 이게 핵심) |
| **Hard limit** | 워크스페이스 Settings → Usage limits → **COMPUTE Hard limit $5** (alert $4) | 초과 시 자동 정지 → 초과요금 차단 |

- ⚠️ Hard limit은 워크스페이스 합산 → **안 쓰는 서비스는 Deployments Remove**(빌드 실패로는 정지 안 됨 — 이전 배포가 계속 돎).
- App Sleeping 하드리밋 도달 시 서비스 중단 → 다음 주기 리셋에 복구(안 뜨면 Redeploy). 데이터·설정 보존.

### 6-3. 결정 배경 (2026-07-13~14 세션 논의 요약)
- **문제 인지**: businesscard가 트래픽 0인데 RAM비 ~$5. "단순 CRUD인데 왜?" → JVM 상시 점유 세금임을 확인. doll_gacha도 상시면 동일.
- **선택지 검토**: ㉮모듈러 모놀리스(앱 병합, 최저비용·콜드스타트 없음, but 시큐리티 병합 난이도 큼) ㉯App Sleeping(코드 0, but 콜드스타트) ㉰메모리튜닝 ㉱DB통합 ㉲Oracle/VPS ㉳언어교체(FastAPI/Go).
- **결정**: **㉯+㉰+㉱** 채택. 이유 = **트래픽 0이라 콜드스타트 20~30초 감수 가능**, **모놀리스 병합은 개발 난이도 커서 회피**. 서비스는 모듈별 분리 유지하되 재우고 DB만 합침.
- **DB per-project → shared로 선회**: 원래 "DB 프로젝트별 분리"였으나 비용 때문에 공통 1개+스키마로. 격리 걱정은 스키마 분리로 해소.
- **버킷은 여전히 per-project**: 버킷은 용량 과금이라 개수 늘어도 요금 불변 → 격리 위해 분리 유지(DB와 반대).
- **향후**: 특정 모듈 트래픽 커지면 그 모듈만 상시화 또는 모놀리스 전환. 새 프로젝트를 가볍게 시작할 땐 FastAPI/Go 고려(기존 앱 재작성은 비추).

---

## 7. 커스텀 도메인 (선택) — 도메인 1개로 서비스 여러 개

**서브도메인은 무제한 무료.** 도메인 하나(`mysite.com`)로 서비스마다 서브도메인 하나씩.
```
mysite.com  (1개만 구매)
├─ doll.mysite.com → doll_gacha
└─ card.mysite.com → businesscard
```
1. **Railway**: 서비스 → Settings → Networking → **Custom Domain** → `doll.mysite.com` 입력 → **CNAME 대상값** 받음
2. **DNS(가비아 등)**: `CNAME  doll  <대상값>` 한 줄 추가. **SSL은 Railway 자동 발급.**
- ⚠️ 루트 도메인(서브도메인 없음)은 CNAME 안 걸림 → 서브도메인 방식이 안전.
- 바꾼 서비스는 **`APP_BASE_URL` + OAuth Redirect URI**도 새 도메인으로 수정.

---

## 8. 마이그레이션 체크리스트 (기존 → 통합)

> 현재 `doll_gacha_mysql`·`businesscard_qr_mysql` 두 DB 서비스 → **1개(total_mysql)로 합치고 나머지 삭제**. 실데이터 없으니 스키마는 앱이 재생성.

### 코드 (반영 완료 — 재배포만)
- [x] `Dockerfile` start.sh: JVM 힙 `-Xmx384m` 기본
- [x] doll_gacha/businesscard 설정 주석: 공통 MySQL + 스키마 분리 명시

### DB 통합 (택1)
- **㉮ 기존 `doll_gacha_mysql` 재사용(추천)**: 거기에 `doll_gacha`·`businesscard_qr` database 2개 생성(§4).
- **㉯ 새 `total_mysql` 생성**: `+New→Database→MySQL` 후 database 2개.

### 적용 & 삭제
1. 두 앱 `SPRING_DATASOURCE_URL` database를 `/doll_gacha`·`/businesscard_qr`로
2. businesscard 정상 확인 후 → **`businesscard_qr_mysql` Delete** (㉯면 `doll_gacha_mysql`도 확인 후 Delete)
   > ⚠️ Delete는 볼륨·데이터까지 삭제. 옮길 실데이터 있으면 dump→restore 후. 지금은 없어 바로 가능.
3. 두 앱 **App Sleeping ON** + **Hard limit $5** + 안 쓰는 서비스 Remove

### 검증
- [ ] doll_gacha `/healthz` UP (로그에 database=doll_gacha)
- [ ] businesscard `/healthz` UP (database=businesscard)
- [ ] MySQL 서비스가 **1개만** 남음
- [ ] idle 시 Usage 컴퓨트 안 오름(App Sleeping 동작)

---

## 9. 문제 시 먼저 볼 것 (실제 겪은 것)

| 증상 | 원인 / 확인 |
|------|------|
| 부팅 실패 + `버킷 endpoint 비어있음` | 버킷을 `${{...}}` 참조로 넣음 → §5 표대로 **실제 값 직접 입력**. `BUCKET_NAME`이 자동 생성명인지 |
| 부팅 실패 + DB `Connection refused` | ①DB Running(초록) ②`${{서비스명.XXX}}`가 실제 DB 서비스명과 일치 ③MySQL 자동변수 안 지웠는지(지웠으면 재생성) |
| 부팅 실패(그 외) | 로그 한글 fail-fast 메시지 — 빠진 env(§3) |
| 화면 뜨는데 JS/CSS 404 | 빌드 로그에서 프론트 static이 jar에 포함됐는지 |
| 로그인 에러/리다이렉트 실패 | 외부 콘솔 Redirect URI가 `<도메인>`과 정확히 일치(§10) |
| 이미지 업로드/표시 실패 | `BUCKET_*` 실제 값인지, region `auto`인지 |
| DB 한글 깨짐 | 수동 적재를 **UTF-8**로(`--default-character-set=utf8mb4`) |
| 요금 초과 | JVM 상시 점유 정상(§6). App Sleeping/메모리/DB통합/Hard limit로 대응 |

---

## 10. 부록 — doll_gacha 배포 실전 메모 (모듈 고유값)

> doll_gacha는 OAuth(카카오·구글) + React 정적 서빙 + 가게 데이터 모듈. 배포 성공(2026-07-13).

**OAuth 콘솔 등록** (`<도메인>` = 생성 도메인)
- 카카오: 플랫폼 Web 사이트 도메인 `https://<도메인>`, Redirect URI `https://<도메인>/login/oauth2/code/kakao` (지도 쓰면 JS키 허용 도메인도)
- 구글: 승인된 리디렉션 URI `https://<도메인>/login/oauth2/code/google`

**가게 데이터 적재** (실참조 데이터 — 운영은 `sql.init.mode: never`라 수동)
- `data-dollshop.sql`은 공공 API 실데이터(2026-01 스냅샷). 앱 배포 후 테이블 생긴 상태에서 **UTF-8로** 1회 적재:
  ```bash
  mysql --default-character-set=utf8mb4 -h <host> -P <port> -u <user> -p<pw> doll_gacha \
    < doll_gacha/src/main/resources/data-dollshop.sql
  ```
- `data-users/community/...sql`은 데모용(로컬 전용) → 운영 미적재. 갱신 시 `TRUNCATE doll_shop;` 후 재적재.
- 확인: `SELECT count(*), gubun1 FROM doll_shop GROUP BY gubun1;` 한글 안 깨졌는지.
