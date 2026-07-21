---
name: architecture
description: total_module 의 시스템 구조와 새 프로젝트(모듈) 편입 기준 — 구조를 바꾸거나 결정하기 전, 새 모듈을 추가할 때, 웹/앱을 어떻게 붙일지 정할 때 반드시 따르는 기준. 모듈=서비스(1:1), 게이트웨이 없음(자기 공개 URL 직행), 루트 단일 Dockerfile+APP_MODULE, 공통 MySQL+스키마 분리, 새 모듈 편입 절차, 웹 유형별 기준. senior-dev·devops 의 구조 결정 기준. 이 스킬과 구조가 어긋나면 이 스킬이 기준이다.
---

# 시스템 아키텍처 & 모듈 편입 (total_module)

> **이 스킬이 구조/편입의 기준이다.** 다른 문서·README와 충돌하면 이 스킬이 우선.
> 사람이 읽는 원본(전체 근거·이력·다이어그램): `total_설계/아키텍처_및_편입기준.md`,
> `서버아키텍처.svg`(런타임 서비스·DB·버킷), `프로젝트구조.svg`(저장소·빌드 흐름).
> 짝 스킬: 배포·비용 → `railway-deploy`, 코드 규칙 → `code-convention`.

## 1. 확정 구조 (한 장 요약) — 이걸 전제로 판단한다

```
GitHub 저장소 1개 (total_module)  =  Railway 프로젝트 1개
빌드: 루트 단일 Dockerfile → 이미지 1개 (모든 모듈 jar 포함)
실행: 모듈 1개 = Railway 서비스 1개 (APP_MODULE 로 실행 모듈 선택)
접근: 각 서비스가 자기 공개 URL 로 직접 트래픽 받음 — ⚠️ 게이트웨이 없음
DB:   공통 MySQL 1개(total_mysql) + 모듈별 스키마(=database) 분리, 스키마명 = 모듈명
파일: 모듈별 Storage Bucket (<모듈명>_bucket, S3 호환)
```

| 항목 | 결정 (바꾸지 말 것 — 바꾸려면 이 스킬부터 고친다) |
|---|---|
| 저장소 / Railway 프로젝트 | **각 1개 고정.** 모듈이 늘어도 서비스만 추가 (프로젝트 추가 아님) |
| 실행 단위 | **모듈 = 서비스 (1:1).** jar 하나로 합치지 않는다 |
| 외부 접근 | **각 서비스 자기 공개 URL 직행.** 게이트웨이/프록시 없음 |
| 빌드 | **루트 단일 Dockerfile + 멀티스테이지.** APP_MODULE 로 실행 모듈 선택 |
| DB | **공통 MySQL 1개 + 모듈별 스키마 분리** (비용) — `railway-deploy` 스킬 |

## 2. 왜 이렇게 결정했나 (agents 는 이 이유를 뒤집는 제안을 하지 않는다)

- **모듈=서비스 (jar 하나로 안 합침)**: 컨셉이 "로컬에서 완성한 프로젝트를 그대로 가져와 배포". 진짜 모놀리스로 합치면 가져올 때마다 병합 수술(SecurityConfig/yml/빈이름/의존성 충돌) + 한 모듈 장애가 전체 전파 + 전체 재배포. 모듈=서비스면 편입 비용이 등록 절차+env 몇 개로 고정되고 모듈끼리 충돌 불가.
- **게이트웨이 없음**: 서비스 분리 순간 각 서비스가 공개 URL을 가져 프록시 존재 이유 소멸. 자작 프록시는 절대 URL이 X-Forwarded에 의존해 깨지고 리다이렉트/에러코드/스트리밍/타임아웃을 재구현해야 함 → 잃는 게 큼. 필요해지면 그때 검증된 것(Spring Cloud Gateway/Nginx)을 인프라 레벨로.
- **루트 단일 Dockerfile**: 모듈들이 같은 Java/Spring 스택 → 인프라 변경을 한 파일에서. 모듈이 10개여도 Dockerfile 1개, 서비스만 추가하고 APP_MODULE만 바꾼다. (스택이 완전히 다른 모듈-Go/Node-이 생기면 그때만 별도 Dockerfile.)

## 3. 저장소 구조

```
/total_module (상위 폴더 — 실행 코드 없음, 스프링부트 아님)
  ├── Dockerfile        # 모든 모듈 jar 를 이미지 하나에 (start.sh 내장, APP_MODULE 로 실행 선택)
  ├── railway.toml      # Railway 빌드/헬스체크(/healthz)
  ├── settings.gradle   # 하위 모듈 명단 (include 'businesscard_qr' 등)
  ├── build.gradle      # 공통 규칙 (거의 비어있음)
  ├── /businesscard_qr      # [모듈] 명함 QR API (Spring Boot)
  ├── /doll_gacha           # [모듈] 인형뽑기 (Spring Boot + React 정적 서빙)
  ├── /businesscard_qr_app  # Flutter 앱 — Gradle 멤버 아님(같이 두는 별개 프로젝트)
  ├── /total_설계            # 전체 설계 문서 (이 스킬들의 사람용 원본)
  ├── /오류해결 · /기억할거     # 작업 기록 · 모듈별 기억 메모
```
- 각 스프링부트 모듈은 **독립 실행 가능한 완전한 앱**(자기 main·jar·gradlew). 게이트웨이/현관문 모듈 없음.

## 4. 새 프로젝트 편입 절차 (체크리스트)

> 전제: 프로젝트는 **로컬에서 완성**해서 가져온다. 여기서는 정리 + 배포 적합화만.
> 편입 = git 관리 주체가 total_module 로 넘어옴. 원 저장소는 이관 전 히스토리 보관소로만 남긴다.

**4-1. 가져오기 전 정리 (순서 중요)**
- [ ] 원 저장소에 push 안 된 커밋 없는지 (`git log --oneline @{u}..HEAD` 가 비어야 안전)
- [ ] ⚠️ **프로젝트 내부 `.git` 폴더 삭제** — 안 지우면 gitlink(중첩 저장소)로 커밋돼 clone 시 내용이 통째로 빠진다 (doll_gacha 실제 사고)
- [ ] 클라이언트 앱(앱/웹)은 최상위 별도 폴더로 분리 (Gradle include 대상 아님)
- [ ] 죽은 리소스 제거(안 쓰는 templates·옛 yml·data-*.sql), 비밀값 점검(.env/yml에 시크릿 금지 → Railway env), 로컬 전용 인프라 파일엔 `# 로컬 개발 전용` 주석

**4-2. 빌드 특이사항** ⚠️
- [ ] 프론트 빌드(npm/vite)가 gradle 태스크에 묶였으면 — 루트 Docker 빌드엔 **node 가 없어** 이미지 빌드가 깨진다. → 산출물을 `static/`에 커밋 + npm 태스크는 `onlyIf`(npm 있을 때만) 가드 = 로컬 자동빌드, Docker 는 커밋된 산출물 사용 (doll_gacha 방식)

**4-3. 배포 적합화 (환경 무관 실행 — `code-convention` §5)**
- [ ] DB 등 설정 **env 주입**(`${SPRING_DATASOURCE_URL:로컬기본}`), `server.port: ${PORT:...}`, **`GET /healthz`**(200 `{status:UP}`)
- [ ] 파일 저장 = **Storage Bucket**(운영)/디스크 폴백(로컬), 운영 인메모리/H2 부팅이면 **fail-fast**(RailwayDeploymentValidator), MySQL 드라이버 포함

**4-4. 등록 (코드)**
1. 폴더를 루트에 투하 → 2. `settings.gradle` 에 `include '<module>'` →
3. 루트 `Dockerfile` 의 `[새 모듈 추가 시]` 3곳(COPY·bootJar·jar추출) + start.sh `APP_MODULE` 허용 목록 →
4. Railway 서비스 생성은 **`railway-deploy` 스킬 B**

**4-5. Git**: 브랜치 → 리뷰 → master 머지. **master push = Railway 재배포 트리거**이므로 배포 env 준비 후 push.

## 5. 웹/앱 유형별 기준

> 접근은 무조건 **자기 공개 URL 직행**. 화면이 어디서 나오냐만 판단.

| 유형 | 화면 서빙 | 편입 시 |
|---|---|---|
| **정적웹 분리형** (CSR+API 분리, github.io/Vercel) | 별도 정적 호스팅 | **백엔드만** 편입 + 화면 잔재 제거 + **CORS(정적 오리진)** + **인증방식 점검** |
| **스프링 일체형** (스프링부트가 직접 서빙) | 스프링부트 | **통째로** 편입. CORS 불필요, 세션쿠키도 됨 |

- **네이티브 앱**(businesscard_qr): 정적웹 분리형과 같되 CORS 불필요.
- ⚠️ **분리형 인증**: JWT면 OK. **세션+쿠키면** 교차도메인 SameSite로 쿠키가 안 붙음 → 토큰 방식 전환 필요.
- doll_gacha 는 React 지만 **스프링부트가 정적 서빙** → 같은 오리진이라 마찰 적음.

## 6. 교훈 (다음 프로젝트를 새로 만든다면 — 처음부터 피할 것)

- **게이트웨이 프록시 자작 금지**. 앱이 API 직접 호출. 필요하면 검증된 Cloud Gateway/Nginx.
- **공개 URL을 요청 헤더에서 유추 금지** — 처음부터 `APP_PUBLIC_BASE_URL` env로 명시, 절대 URL을 여기서 조립. `forward-headers-strategy: framework`.
- **운영 인메모리 DB면 즉시 fail-fast** — "조용한 성공"보다 "시끄러운 실패".
- **Flutter**(이번에 가장 부족): 단일 ApiClient, 모든 호출 타임아웃, 401→refresh 1회→실패 시 재로그인, 5xx/비-JSON 분기(콜드스타트 UX), base URL 기본값도 운영 HTTPS(localhost 금지), `.env` 커밋 금지, JSON 계약 문서 고정.
- 스프링부트 상세 규칙은 `code-convention` 스킬.

## 참고 이력
- 게이트웨이(dist_api_gateway)는 2026-07-08 삭제 완료. 부활 필요 시 git 히스토리에서.
