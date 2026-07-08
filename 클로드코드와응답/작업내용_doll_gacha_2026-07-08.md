# 작업내용 — doll_gacha 모듈 편입 + Railway 배포 적합화 (2026-07-08)

> 브랜치: `doll_gacha모듈추가브랜치`
> 요청: "doll_gacha 프로젝트(기본 동작은 잘 됨) 전체 검사 및 수정 — **배포 환경에서 동작하도록**"
> 절차 기준: [`total_설계/아키텍처_방향결정.md`](../total_설계/아키텍처_방향결정.md) §3, [`total_설계/로컬프로젝트_편입시_정리할것.md`](../total_설계/로컬프로젝트_편입시_정리할것.md)
> 검증: doll_gacha 테스트 **77/77 통과**, npm 없는 환경(Docker 빌더) 시뮬레이션 빌드 성공, 루트 통합 bootJarAll 성공

---

## 1. 한눈에 보기

| 단계 | 내용 | 상태 |
|------|------|:---:|
| 정리 | 중첩 .git 제거(push 확인 후), doll_gacha_app 잔재 정리, 로컬 전용 파일 표시 | ✅ |
| 루트 등록 | settings.gradle · Dockerfile · start.sh · bootJarAll · .dockerignore | ✅ |
| 배포 적합화 | 아래 §3 — npm 가드, healthz, 로그, 시크릿, 프록시, validator 등 | ✅ |
| 검증 | 테스트 77/77 + Docker 빌더(npm 없음) 경로 확인 | ✅ |
| Railway 서비스 생성 | **사용자 작업** — §5 | ⬜ |

doll_gacha 정체: **화면+API 일체형** (Vite 프론트 → Spring static/으로 빌드·커밋, 같은 도메인에서 서빙).
자기 공개 URL 직행 — CORS·프리픽스 불필요. DB는 MySQL(prod), 파일 저장은 **Supabase Storage**, 로그인은 **카카오/구글 OAuth2 + 자체 JWT**.

---

## 2. 편입/등록 (루트 저장소 변경)

- `settings.gradle`: `include 'doll_gacha'`
- 루트 `build.gradle`: `bootJarAll`에 `:doll_gacha:bootJar`
- `Dockerfile`: COPY/bootJar/jar 추출·복사 + start.sh 허용목록 `businesscard_qr|doll_gacha` + `SPRING_PROFILES_ACTIVE`·`SUPABASE_URL`·`SUPABASE_KEY` 따옴표 정리
- `.dockerignore`: 옛 경로 정리 + `doll_gacha/logs·data·frontend/dist` 제외
- 편입 정리: 중첩 `.git` 제거(원 저장소 push 완료 확인 후 — 히스토리는 github.com/gks930620/doll_gacha에 보존),
  docker-compose/자체 Dockerfile에 "로컬 개발 전용" 주석, 컨테이너명 doll_gacha_app → doll_gacha_server

## 3. 배포 적합화 (doll_gacha 내부 수정)

### 🔴 치명 수정 2건
1. **npm 태스크가 Docker 빌드를 깨뜨리는 문제**: `processResources → copyFrontend → npmBuild → npmInstall` 체인이
   node 없는 루트 Docker 빌더에서 실패 → **npm 감지 가드** 추가 (Windows `where.exe`/Linux `which` 모두 지원).
   npm 있으면(로컬) 기존대로 자동 빌드, 없으면(Docker) 커밋된 static/ 사용. **양쪽 경로 실제 검증 완료.**
2. **`.gitignore`가 `static/assets/`를 무시하던 문제**: 이대로 커밋하면 JS/CSS 번들이 저장소에서 빠져
   Railway 배포 시 **빈 화면(에셋 404)** — ignore 라인 제거. (이전 에이전트도 못 잡았던 함정)

### 주요 수정
- **`GET /healthz`** 추가 (permitAll, JWT 필터 통과) — 루트 railway.toml 헬스체크 대응
- **`RailwayDeploymentValidator`** 신설: `RAILWAY_PROJECT_ID` 감지 시 fail-fast —
  prod 프로파일 미활성 / datasource가 빈값·localhost·H2 / JWT 시크릿·Supabase·OAuth 클라이언트 미설정 / APP_BASE_URL이 localhost → 부팅 실패 (한글 안내)
- **로그**: prod는 콘솔 전용 (파일 로깅 제거 — 휘발성 디스크 + Railway가 stdout 수집)
- **프록시 대응**: `forward-headers-strategy: framework` — OAuth2 redirect_uri가 공개 https 도메인으로 생성
- **하드코딩 제거**: OAuth2 성공 핸들러의 `http://10.0.2.2:8080`(안드로이드 에뮬레이터) → env화(`APP_OAUTH2_REDIRECT_BASE`)
- 오래된 빌드 잔재 `static/assets/index-CNfVHD-n.js` 삭제

### 검사 결과 이상 없음 (확인만)
- 시크릿: yml에 커밋된 실제 자격증명 **없음** (전부 `${ENV}` 참조, 실값은 gitignore된 .env에)
- 파일 저장: prod는 `SupabaseFileStorage`(enabled=true), 로컬 디스크 저장은 dev 전용 — 휘발성 디스크 안전
- 프론트: API 호출 전부 상대경로(same-origin) — 수정 불필요. vite의 localhost는 dev 프록시 전용
- 시드 SQL(data-*.sql): prod `sql.init.mode: never` ✓ / 쿠키 secure·SameSite ✓

### 알고 있으면 되는 것 (의도적 보류)
| 항목 | 심각도 | 내용 |
|------|:---:|------|
| OAuth2 로그인 상태가 인메모리 | 중 | 서버 **1대일 땐 문제없음**. 스케일아웃(복제 2대+) 시 웹 OAuth 로그인 깨짐 (코드에 Redis TODO 있음) |
| prod `ddl-auto: update` | 하 | 당분간 허용. 시드가 꺼져 있어 **prod DB는 빈 상태로 시작** — 인형뽑기샵 데이터는 수동 적재 필요 |
| CORS 허용 목록 하드코딩 | 하 | `dollgacha-production.up.railway.app`·`dollgacha.shop` 고정 — 실제 도메인이 다르면 (교차 출처 호출에 한해) 수정 필요 |
| Swagger prod 노출 | 하 | 공개 API 문서 — 필요 시 prod에서 springdoc 비활성 검토 |
| 카카오 지도 JS 키 하드코딩 | 정보 | 공개용 키(도메인 제한 방식)라 정상 — 단 콘솔에 배포 도메인 등록 필요 (§5) |

---

## 4. 검증 결과

| 검증 | 결과 |
|------|------|
| doll_gacha 단독 테스트 | ✅ **77/77** (H2 인메모리, 로컬 인프라 불필요) |
| npm 없는 환경 시뮬레이션 (Docker 빌더 경로) | ✅ 가드가 프론트 태스크 skip → 커밋된 static으로 빌드 성공 |
| 루트 통합 `bootJarAll` (두 모듈 함께) | ✅ (백그라운드 실행 — 결과는 대화에서 보고) |

---

## 5. 사용자가 해야 할 일 (Railway + 외부 콘솔)

### ① Railway — doll_gacha용 DB 서비스 생성
`+ New → Database → MySQL` (기존 mysql과 **별도** — 테이블명 충돌 방지). 예: 서비스명 `mysql-doll`

### ② Railway — doll_gacha 서비스 생성
`+ New → Service → GitHub Repo(total_module)` → 이름 `doll_gacha` → Generate Domain → Variables:

| 변수 | 값 | 비고 |
|------|-----|------|
| `APP_MODULE` | `doll_gacha` | 필수 |
| `SPRING_PROFILES_ACTIVE` | `prod` | 필수 (validator가 강제) |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://${{mysql-doll.MYSQLHOST}}:${{mysql-doll.MYSQLPORT}}/${{mysql-doll.MYSQLDATABASE}}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8` | DB 서비스명에 맞게 |
| `SPRING_DATASOURCE_USERNAME` / `PASSWORD` | `${{mysql-doll.MYSQLUSER}}` / `${{mysql-doll.MYSQLPASSWORD}}` | 필수 |
| `JWT_SECRET_KEY` | 랜덤 긴 문자열 | 필수 (없으면 기동 실패) |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | 카카오 개발자 콘솔 값 | 필수 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 구글 클라우드 콘솔 값 | 필수 |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase 프로젝트 값 | 필수 (파일 저장) |
| `APP_BASE_URL` | `https://<doll_gacha 공개 도메인>` | 필수 — OAuth redirect 기준 |
| `APP_OAUTH2_REDIRECT_BASE` | (선택) | 앱 웹뷰 플로우용, 현재 미사용 |

### ③ 외부 콘솔 등록 (안 하면 로그인/지도 실패)
- **카카오 개발자 콘솔**: 배포 도메인을 Web 플랫폼에 추가 + Redirect URI `https://<도메인>/login/oauth2/code/kakao` 등록 (지도 키의 허용 도메인에도 추가)
- **구글 클라우드 콘솔**: 승인된 리디렉션 URI `https://<도메인>/login/oauth2/code/google` 등록

### ④ 배포 후 확인
1. [ ] `https://<도메인>/healthz` → UP
2. [ ] 화면(프론트) 정상 로드 — JS/CSS 404 없는지 (🔴 gitignore 수정 검증 포인트)
3. [ ] 카카오/구글 로그인 → redirect가 배포 도메인으로 오는지
4. [ ] 이미지 업로드 → Supabase 저장 확인, 재배포 후 보존
5. [ ] 인형샵 데이터 수동 적재 (시드 SQL은 prod에서 안 돎)
