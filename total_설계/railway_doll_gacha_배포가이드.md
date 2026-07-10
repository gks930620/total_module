# doll_gacha Railway 배포·확인 가이드

> 작성일: 2026-07-08
> 대상: **사용자가 Railway 대시보드에서 직접** 하는 작업. 코드/빌드는 이미 준비됨(모듈 편입 + 배포 적합화 완료).
> 전제: total_module이 이미 Railway 프로젝트 1개로 배포돼 있고(businesscard_qr, mysql 서비스 존재), master에 doll_gacha가 올라간 상태.
> 방향 기준: [`아키텍처_방향결정.md`](아키텍처_방향결정.md) — doll_gacha도 **자기 공개 URL 직행**(게이트웨이 없음).

---

## 0. 준비물 (미리 손에 들고 있을 것)

| 값 | 어디서 |
|----|--------|
| 카카오 `CLIENT_ID` / `CLIENT_SECRET` | 카카오 개발자 콘솔 (내 애플리케이션 → 앱 키 / 보안) |
| 구글 `CLIENT_ID` / `CLIENT_SECRET` | Google Cloud Console → 사용자 인증 정보(OAuth 2.0 클라이언트) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase 프로젝트 → Settings → API |
| `JWT_SECRET_KEY` | 직접 생성 (랜덤 긴 문자열, 예: `openssl rand -base64 48`) |

---

## 1. doll_gacha 전용 MySQL 서비스 생성

> businesscard_qr의 mysql과 **분리**한다 (테이블명 충돌 방지 + 관리 분리).

1. Railway 프로젝트 캔버스 → `+ New` → `Database` → `MySQL`
2. 서비스 이름을 알아보기 쉽게 변경 (예: `mysql-doll`)
3. 생성 후 `Variables` 탭에 `MYSQLHOST/MYSQLPORT/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD` 자동 생성 확인
4. (볼륨이 자동으로 붙음 → 재배포에도 데이터 보존)

---

## 2. doll_gacha 서비스 생성

1. `+ New` → `Service` → `GitHub Repo` → `gks930620/total_module` 선택
2. 서비스 이름을 `doll_gacha`로 변경
3. `Settings` 확인:
   - Source: `gks930620/total_module`, Branch: `master`
   - Root Directory: 비움(기본) 또는 `/`
   - Build/Start Command: **비움** (루트 Dockerfile이 처리)
   - Healthcheck Path: `/healthz`
4. `Settings → Networking → Public Networking → Generate Domain` 클릭 → 생성된 도메인 메모 (예: `dollgacha-production.up.railway.app`) — 아래 `APP_BASE_URL`에 사용

---

## 3. doll_gacha 서비스 환경변수 입력

`doll_gacha` 서비스 → `Variables` 에 아래를 넣는다. `${{mysql-doll.XXX}}`는 1단계 DB 서비스명에 맞춘다.

```env
APP_MODULE=doll_gacha
SPRING_PROFILES_ACTIVE=prod

SPRING_DATASOURCE_URL=jdbc:mysql://${{mysql-doll.MYSQLHOST}}:${{mysql-doll.MYSQLPORT}}/${{mysql-doll.MYSQLDATABASE}}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
SPRING_DATASOURCE_USERNAME=${{mysql-doll.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{mysql-doll.MYSQLPASSWORD}}

JWT_SECRET_KEY=<랜덤 긴 문자열>

KAKAO_CLIENT_ID=<카카오 REST 키>
KAKAO_CLIENT_SECRET=<카카오 시크릿>
GOOGLE_CLIENT_ID=<구글 클라이언트 ID>
GOOGLE_CLIENT_SECRET=<구글 시크릿>

SUPABASE_URL=<supabase 프로젝트 URL>
SUPABASE_ANON_KEY=<supabase anon key>

APP_BASE_URL=https://<2단계에서 생성한 doll_gacha 도메인>
```

> ⚠️ 필수값(`SPRING_DATASOURCE_*`, `JWT_SECRET_KEY`, `SUPABASE_*`, OAuth, `SPRING_PROFILES_ACTIVE=prod`, `APP_BASE_URL`)이
> 빠지거나 `APP_BASE_URL`이 localhost면 **부팅이 실패**한다 (RailwayDeploymentValidator fail-fast). 실패는 정상 동작 —
> 로그에 어떤 값이 빠졌는지 한글로 나온다.
> `${{...}}` 입력은 입력창에서 `${{` 치고 자동완성으로 넣는 게 안전.

---

## 4. 외부 콘솔에 배포 도메인 등록 (안 하면 로그인·지도 실패)

배포 도메인이 정해졌으니 OAuth·지도 제공자에 등록한다. `<도메인>` = 2단계에서 생성한 값.

### 카카오 개발자 콘솔
- **플랫폼 → Web**: 사이트 도메인에 `https://<도메인>` 추가
- **카카오 로그인 → Redirect URI**: `https://<도메인>/login/oauth2/code/kakao` 추가
- **(지도 사용 시)** JavaScript 키의 허용 도메인에 `https://<도메인>` 추가

### 구글 클라우드 콘솔 (OAuth 2.0 클라이언트)
- **승인된 리디렉션 URI**: `https://<도메인>/login/oauth2/code/google` 추가

---

## 5. 배포 실행

1. 위 설정 후 `doll_gacha` 서비스가 자동 배포됨. 안 되면 `Deployments` 탭 → `Redeploy`
2. 빌드 로그에서 `BUILD SUCCESSFUL` + 앱 기동 로그 확인
   - 참고: 첫 빌드는 gradle + 프론트(static 포함) 빌드라 몇 분 걸릴 수 있음
   - 첫 기동 시 `ddl-auto: update`가 **빈 테이블을 생성**한다(운영은 시드를 자동 실행하지 않음 → §5.5).

---

## 5.5. ⚠️ 가게(인형뽑기) 데이터 수동 적재 — **안 하면 맵/목록이 빈 채로 뜬다**

운영(prod)은 `spring.sql.init.mode: never`라 시드 `.sql`을 **자동 실행하지 않는다.** 이유:
- `data-users/community/review/comment/files.sql`은 **데모/개발용 가짜 데이터**이고,
  특히 `data-files.sql`은 `C:/workspace/...` 로컬 경로가 박혀 있어 운영에 넣으면 안 된다.
- 따라서 운영에 넣을 것은 **실제 가게 참조 데이터인 `data-dollshop.sql` 하나뿐**이다. (나머지는 실제 사용자가 로그인/작성하며 채워짐)

### 적재 방법 (최초 1회)
1. **앱을 먼저 한 번 배포**해서 테이블이 생성된 상태로 만든다(위 §5).
2. Railway `mysql-doll` 서비스 → `Variables`/`Connect` 에서 **공개 접속 정보**(host, port, user, password, db)를 확인한다.
3. 로컬에서 **UTF-8로** `data-dollshop.sql`을 적재한다 (⚠️ 인코딩 주의 — 안 그러면 로컬에서 겪은 한글 깨짐이 운영에서 재발):
   ```bash
   mysql --default-character-set=utf8mb4 -h <host> -P <port> -u <user> -p<password> <db> \
     < doll_gacha/src/main/resources/data-dollshop.sql
   ```
   - GUI(DBeaver/Workbench)로 열어 실행해도 됨 — **인코딩을 UTF-8로** 지정할 것.
4. 적재 후 `SELECT count(*), gubun1 FROM doll_shop GROUP BY gubun1;` 로 한글이 안 깨졌는지 확인.

> 이 데이터는 Railway MySQL 볼륨에 **영속**되므로 재배포해도 유지된다(1회만 적재하면 됨).

---

## 6. 배포 확인 체크리스트 (사용자가 눈으로)

- [ ] **헬스체크**: `https://<도메인>/healthz` → `{"service":"doll_gacha","status":"UP"}`
- [ ] **화면 로드**: `https://<도메인>/` 접속 → React 화면이 뜨고 **JS/CSS 404가 없는지**(브라우저 개발자도구 Network 탭). ← 편입 시 잡은 핵심 포인트
- [ ] **가게 데이터/맵**: `data-dollshop.sql` 적재(§5.5) 후 `/map`·매장 목록에 가게가 뜨고 **한글이 안 깨지는지**
      (적재 전이면 비어 있는 게 정상)
- [ ] **카카오 로그인**: 로그인 → 카카오 동의 → `<도메인>`으로 리다이렉트되어 로그인 완료되는지
- [ ] **구글 로그인**: 위와 동일
- [ ] **이미지 업로드**: 리뷰/게시글에 이미지 첨부 → Supabase에 저장되고 표시되는지, **재배포 후에도 보존**되는지
- [ ] **(지도)** 지도 페이지에서 카카오 지도가 뜨는지 (안 뜨면 4단계 지도 도메인 등록 확인)

---

## 7. 문제 시 먼저 볼 것

| 증상 | 확인 |
|------|------|
| 부팅 실패(서비스 죽음) | 로그의 한글 fail-fast 메시지 — 빠진 env 확인 (§3) |
| 화면은 뜨는데 JS/CSS 404 | 빌드 로그에서 프론트 static 포함 여부 (이론상 해결됨) |
| 로그인 눌러도 에러/리다이렉트 실패 | 카카오·구글 콘솔의 Redirect URI가 `<도메인>`과 정확히 일치하는지 (§4) |
| 이미지 업로드 실패 | `SUPABASE_URL`/`SUPABASE_ANON_KEY` + Supabase 버킷 권한 |
| 맵/매장 목록이 비어있음 | `data-dollshop.sql` 미적재 — §5.5대로 1회 적재 |
| 매장 목록의 한글이 깨짐 | §5.5 적재를 **UTF-8**로 다시 (`--default-character-set=utf8mb4`) |

---

> businesscard_qr 쪽 남은 작업(게이트웨이 서비스 삭제 등)은 [`../클로드코드와응답/사용자가해야할일.md`](../클로드코드와응답/사용자가해야할일.md) 참고.
