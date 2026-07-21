---
name: railway-deploy
description: total_module 을 Railway 에 배포하는 절차 — 기존 모듈 재배포, 새 모듈 편입+첫 배포, 환경변수 규칙, 배포 확인, 실전 트러블슈팅. "배포해줘", "Railway에 올려줘", "새 모듈 추가하자" 요청 시 이 절차를 따른다. 아키텍처(모듈=서비스, 공통 MySQL+스키마, 모듈별 버킷, App Sleeping) 요약 포함.
---

# Railway 배포 (total_module)

## 아키텍처 한 장 요약 — 이 구조를 전제로 배포한다

```
저장소 1개 = Railway 프로젝트 1개 (total_module)
빌드: 루트 단일 Dockerfile → 이미지 1개 (모든 모듈 jar 포함, JVM 힙 -Xmx384m 기본)
실행: 모듈 1개 = Railway 서비스 1개 — 어느 모듈을 띄울지는 APP_MODULE 환경변수로 선택
      ⚠️ Root Directory 는 항상 "/" (모듈 폴더를 고르는 게 아니다!)
접근: 각 서비스가 자기 공개 URL 직행 (게이트웨이 없음), 헬스체크 GET /healthz
DB:   공통 MySQL 1개(total_mysql) + 모듈별 database(스키마) 분리 — 스키마명 = 모듈명
파일: 모듈별 Storage Bucket (<모듈명>_bucket, S3 호환)
비용: 앱 서비스 App Sleeping ON + Usage limits COMPUTE Hard limit $5
배포 트리거: master push = 자동 재배포 (모든 모듈 서비스가 같은 레포를 봄)
```

## 원본 문서 (상세는 여기 — 이 스킬은 절차 요약)

| 문서 | 내용 |
|---|---|
| `total_설계/railway_배포_및_비용.md` | 배포 전 절차·env 템플릿·DB/버킷·비용 최적화·트러블슈팅 **전체 기준** |
| `total_설계/아키텍처_및_편입기준.md` | 왜 이 구조인지 + **새 모듈 편입 절차**(§4) + 웹 유형별 기준 |
| `total_설계/서버아키텍처.svg` / `프로젝트구조.svg` | 런타임 서비스 구조 / 저장소·빌드 흐름 다이어그램 |
| `오류해결/businesscard_qr_배포가이드_2026-07-15.md` | businesscard_qr 모듈의 **구체 값**(env 이름·주소 3개 일치·나중 과제) |
| `기억할거/` | 모듈별 기억할 메모 (캐시 전략, DB 잔여 컬럼, 배포·운영 현황 등) |

## 사전 확인 (Prerequisites)

- [ ] **빌드·테스트 통과** — java 가 PATH에 없으므로:
  ```powershell
  $env:JAVA_HOME = "C:\Users\gks93\.jdks\corretto-17.0.19"; $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  .\gradlew.bat --no-daemon :<모듈>:test
  ```
- [ ] **변경이 master 에 merge + push 됐는지** — Railway 는 master 만 본다. 브랜치에만 있으면 배포 안 됨.
- [ ] (CLI 쓸 때) `railway whoami` 로그인 확인. 링크: `railway link -p total_module -e production`
- [ ] ⚠️ **앱↔백엔드 API 계약이 바뀌는 변경**(응답 형태 등)이면 앱과 백엔드를 같이 배포해야 한다.

## A. 기존 모듈 재배포

1. master 에 merge + push → **자동 배포됨** (별도 조작 불필요)
2. 배포 확인(아래 Verify). App Sleeping 상태면 첫 요청이 10~30초(콜드스타트) — 정상.

## B. 새 모듈 편입 + 첫 배포

**① 코드 편입** (상세: `아키텍처_및_편입기준.md` §4)
1. 모듈 내부 `.git` 삭제(gitlink 방지) → 폴더를 루트에 투하
2. `settings.gradle` 에 `include '<모듈>'`
3. 루트 `Dockerfile` 의 `[새 모듈 추가 시]` 주석 3곳(COPY·bootJar·jar 추출) + start.sh APP_MODULE 허용 목록
4. 배포 적합화: env 주입(`${ENV:로컬기본}`), `server.port: ${PORT:...}`, `GET /healthz`,
   파일저장 버킷+디스크폴백, RailwayDeploymentValidator(fail-fast), MySQL 드라이버(`com.mysql:mysql-connector-j`)
5. master merge + push

**② Railway 리소스 생성** (대시보드)
1. (파일 쓰면) 버킷 `+ New → Bucket` → `<모듈명>_bucket` → **화면의 S3 자격증명 5개 복사**
2. 서비스 `+ New → Service → GitHub Repo(total_module)` → 이름=모듈명 →
   Settings: Branch `master`, **Root Directory 비움(/)**, Build/Start 비움, Healthcheck `/healthz`
3. `Networking → Generate Domain` → 도메인 메모

**③ 환경변수** (그 서비스 Variables — 전체 템플릿은 `railway_배포_및_비용.md` §3)
```
APP_MODULE=<모듈>
SPRING_DATASOURCE_URL=jdbc:mysql://${{total_mysql.MYSQLHOST}}:${{total_mysql.MYSQLPORT}}/<모듈>?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8&createDatabaseIfNotExist=true
SPRING_DATASOURCE_USERNAME=${{total_mysql.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{total_mysql.MYSQLPASSWORD}}
# + JWT/OAuth/base URL/BUCKET_* 는 모듈별 — 배포가이드 참조
```
핵심 규칙:
- **DB 는 `${{total_mysql.XXX}}` 참조** (스키마는 URL 끝 `/<모듈>`, createDatabaseIfNotExist 로 자동 생성)
- **버킷은 참조 불가 → 화면 실제 값 직접 입력** (`BUCKET_NAME` 은 자동 생성된 실제 버킷명, `BUCKET_REGION=auto`)
- base URL env(`APP_BASE_URL`/`APP_PUBLIC_BASE_URL`)·JWT env 이름은 **모듈마다 다름** — 그 모듈 배포가이드 확인
- fail-fast: 필수 env 빠지면 부팅 실패하고 로그에 한글로 뭐가 빠졌는지 나옴 (의도된 동작)

**④ 배포 후**: App Sleeping ON (Settings → Serverless). Hard limit 은 워크스페이스 공통이라 이미 적용.

## 배포 확인 (Verify)

- [ ] `https://<도메인>/healthz` → `{"status":"UP"}` — **UP = DB·JWT·버킷 env 전부 정상** (fail-fast 라 하나라도 틀리면 안 뜸)
- [ ] (Swagger 있는 모듈) `/swagger-ui.html` 열림 + 인증 필요 API 를 토큰 없이 호출 → **401** (500이면 문제)
- [ ] 로그: `railway logs -s <서비스> -d --lines 50` — `HikariPool Start completed` → `Started ...Application`

## 트러블슈팅 (실제 겪은 것)

| 증상 | 원인 → 해결 |
|---|---|
| 부팅 실패 + `버킷 endpoint 비어 있습니다` | 버킷 값을 `${{...}}` 참조로 넣음 → **실제 값 직접 입력** |
| 부팅 실패 + DB `Connection refused` | ① total_mysql Running? ② 참조의 서비스명 일치? ③ **MySQL 자동변수(MYSQLHOST 등) 지웠는지** — 지웠으면 DB 재생성이 답 |
| 부팅 실패 + 한글 fail-fast 메시지 | 그 메시지가 답 — 빠진 env 채우기 |
| `Cannot load driver class: com.mysql.cj.jdbc.Driver` | 모듈 build.gradle 에 `com.mysql:mysql-connector-j` 누락 |
| healthz UP 인데 이미지/QR 만 엉뚱한 주소 | base URL env 누락/불일치 (warn 만 하고 부팅됨) — **①생성 도메인 ②앱 설정 ③서버 base URL env 셋이 같아야 함** |
| 첫 요청 10~30초 멈춤 | App Sleeping 콜드스타트 — 정상 |
| push 했는데 배포 안 뜸 | master 인지 확인, 서비스 Settings 의 Auto deploy(라벨 "Disable" = 켜져 있음) |
| 버킷 credentials 생성 실패("unexpected error") | Railway 플랫폼 버그였음 — CLI 로 진단(`railway bucket credentials -b <버킷>`), 안 되면 station.railway.com 신고 |
| 빌드 실패로 요금 멈추길 기대 | 안 멈춤(이전 배포가 계속 돎) — 멈추려면 Deployments **Remove** |
