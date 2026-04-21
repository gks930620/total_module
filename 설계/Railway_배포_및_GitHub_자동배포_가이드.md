# Railway 배포 및 GitHub 자동 배포 가이드

## 1) 이번에 코드에서 반영한 내용

아래 항목은 이미 프로젝트에 수정 반영됨.

- `src/main/resources/application.yml`
  - `server.port: ${PORT:8080}` 추가 (Railway 동적 포트 대응)
  - `server.forward-headers-strategy: framework` 추가 (프록시 환경 대응)
  - `app.cors.allowed-origins: ${APP_CORS_ALLOWED_ORIGINS:http://localhost:8080}` 추가
- `src/main/resources/application-prod.yml`
  - DB 변수에 Railway MySQL 기본 변수 fallback 추가
    - `APP_DB_HOST` 없으면 `MYSQLHOST` 사용
    - `APP_DB_PORT` 없으면 `MYSQLPORT` 사용
    - `APP_DB_USERNAME` 없으면 `MYSQLUSER` 사용
    - `APP_DB_PASSWORD` 없으면 `MYSQLPASSWORD` 사용
    - `APP_DB_DEFAULT_NAME` 없으면 `MYSQLDATABASE` 사용
  - `supabase.enabled`를 `SUPABASE_ENABLED` 환경변수로 제어 가능하게 변경
- `Dockerfile`
  - 헬스체크를 고정 `8080`에서 `${PORT:-8080}` 기반으로 변경
  - 헬스체크 HTTP 코드 `200` 또는 `401`을 정상으로 처리 (Spring Security 기본 보안 환경 대응)

---

## 2) 내가 해야 할 작업 체크리스트

### A. GitHub 저장소 준비

현재 폴더가 Git 저장소가 아니라면 먼저 저장소를 연결해야 함.

```bash
git init
git add .
git commit -m "chore: railway deploy config"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

이미 Git 저장소라면 `git add/commit/push`만 하면 됨.

### B. Railway 프로젝트 생성 + GitHub 연동

1. Railway 로그인
2. `New Project` -> `Deploy from GitHub repo`
3. 방금 푸시한 저장소 선택
4. 브랜치 `main` 지정
5. Auto Deploy(푸시 시 자동 배포) 활성화 확인

이후부터는 `main` 브랜치에 커밋/푸시할 때마다 Railway가 자동 배포함.

### C. 환경변수 설정 (Railway 서비스 Variables)

필수:

- `JWT_SECRET_KEY`
- `APP_CORS_ALLOWED_ORIGINS` (예: `https://your-frontend-domain.com`)

DB 설정:

- Railway MySQL을 같은 프로젝트에 추가한 경우:
  - 보통 `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`가 자동 주입됨
  - 이번 코드 수정으로 별도 매핑 없이 동작 가능
- 외부 DB 사용 시:
  - `APP_DB_HOST`, `APP_DB_PORT`, `APP_DB_USERNAME`, `APP_DB_PASSWORD`, `APP_DB_DEFAULT_NAME` 설정

선택:

- `APP_DB_DEFAULT_PROJECT` (기본값 `default`)
- `APP_DB_MAX_POOL_SIZE`, `APP_DB_MIN_IDLE`, `APP_DB_IDLE_TIMEOUT`, `APP_DB_CONNECTION_TIMEOUT`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ENABLED` (기본값 `true`)

### D. 첫 배포 확인

1. Railway Deploy Logs에서 빌드/실행 성공 확인
2. 서비스 도메인 확인 (`https://<service>.up.railway.app`)
3. 헬스체크 확인: `GET /actuator/health`
4. 프론트 도메인에서 API 호출 시 CORS 오류 없는지 확인

---

## 3) 이후 운영 방식

일상 배포 흐름은 아래와 같음.

1. 로컬 코드 수정
2. `git commit`
3. `git push origin main`
4. Railway 자동 배포

즉, 목표한 "커밋(정확히는 push)만 하면 자동 배포" 구조가 완성됨.

---

## 4) 운영 시 주의사항

- Railway 컨테이너 파일시스템은 영구 저장소가 아님.
  - `file.upload-dir=/app/uploads`에 저장한 파일은 재배포/재시작 시 유실될 수 있음.
  - 영구 파일 저장은 Supabase Storage/S3 같은 외부 스토리지 사용 권장.
- 운영에서는 `JWT_SECRET_KEY`를 충분히 긴 랜덤 문자열로 관리할 것.
