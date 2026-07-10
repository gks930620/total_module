# Railway 배포 실행 가이드 (처음부터)

> 2026-07-08 개정: 게이트웨이 은퇴 반영 ([`아키텍처_방향결정.md`](아키텍처_방향결정.md) 기준).
> 서비스 구성 = **mysql(DB) + 모듈별 서비스**. 각 서비스는 자기 공개 URL로 직접 트래픽을 받는다.

이 문서는 Railway를 처음 쓰는 상황 기준. 순서대로 진행하면 `total_module` 저장소를 배포할 수 있다.

---

## 0. 시작 전 핵심 규칙

1. 환경변수 값에 따옴표(`"`) 넣지 않는다 (넣어도 start.sh가 벗겨주긴 함).
2. `<...>` 형태 예시는 반드시 실제 값으로 바꾼다.
3. 모든 모듈 서비스는 같은 저장소(`gks930620/total_module`)를 사용한다.
4. Root Directory는 기본값(비워둠) 또는 `/`.
5. Custom Build Command/Start Command는 비워둔다 (루트 Dockerfile이 처리).

---

## 1. Railway 프로젝트 생성 (최초 1회)

1. `New Project` → **`Empty Project`** 선택 (이 단계에서 GitHub 연결하지 않음)
2. 프로젝트 이름 변경(선택): 예 `total_module`

## 2. MySQL 서비스 생성 (최초 1회)

1. 캔버스에서 `+ New` → `Database` → `MySQL`
2. 서비스 이름 `mysql` 권장
3. `Variables`에 `MYSQLHOST/MYSQLPORT/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD` 자동 생성 확인
4. 볼륨(mysql-volume)이 붙어 있으면 재배포에도 데이터 보존됨

## 3. 모듈 서비스 생성 (모듈마다 반복 — businesscard_qr 예시)

1. `+ New` → `Service` → `GitHub Repo` → `gks930620/total_module`
2. 서비스 이름을 모듈명으로 변경 (예: `businesscard_qr`)
3. `Settings` 확인: Branch `master`, Root Directory 비움, Build/Start Command 비움, Healthcheck `/healthz`
4. `Networking` → `Generate Domain` → 생성된 도메인 메모 (예: `businesscardqr-production.up.railway.app`)
5. `Variables` 입력:

```env
APP_MODULE=businesscard_qr
APP_JWT_SECRET=<랜덤 32자+ 문자열>
SPRING_DATASOURCE_DRIVER=org.mariadb.jdbc.Driver
SPRING_DATASOURCE_URL=jdbc:mariadb://${{mysql.MYSQLHOST}}:${{mysql.MYSQLPORT}}/${{mysql.MYSQLDATABASE}}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC
SPRING_DATASOURCE_USERNAME=${{mysql.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{mysql.MYSQLPASSWORD}}
SPRING_JPA_DDL_AUTO=update
APP_PUBLIC_BASE_URL=https://<4에서 생성한 자기 도메인>
```

- `${{mysql.XXX}}`는 mysql 서비스의 변수를 참조하는 문법. 입력창에서 `${{` 치고 자동완성 사용이 안전.
- ⚠️ `SPRING_DATASOURCE_*`가 없으면 **부팅 자체가 실패**한다(의도된 fail-fast — 조용히 H2로 떠서 데이터가 날아가는 걸 방지).
- `APP_PUBLIC_BASE_URL`은 **이 서비스 자신의 공개 도메인** (QR/이미지/다운로드 URL의 기준).
- 웹 클라이언트가 있는 모듈이면 `APP_CORS_ALLOWED_ORIGINS=<웹 도메인>` 추가.

6. Deploy → `https://<도메인>/healthz`가 `status: UP`이면 성공.

## 4. 클라이언트 연결

- 앱/웹의 base URL = **해당 모듈 서비스의 공개 도메인** (예: 명함QR 앱 → `https://businesscardqr-production.up.railway.app`)
- 게이트웨이를 거치지 않는다.

## 5. 새 모듈(프로젝트 A) 추가 시

> 이미 편입된 **doll_gacha**의 서비스 생성·env·시드 적재 상세는 [`railway_doll_gacha_배포가이드.md`](railway_doll_gacha_배포가이드.md) 참고.

코드 쪽 절차는 [`아키텍처_방향결정.md`](아키텍처_방향결정.md) §3. Railway 쪽은 위 §3을 새 모듈명으로 반복하면 끝
(DB가 필요하면 §2처럼 DB 서비스 추가 또는 기존 mysql 공유).

---

## 현재 배포 주소

- businesscard_qr: `https://businesscardqr-production.up.railway.app`
- ~~dist_api_gateway: distapigateway-production.up.railway.app~~ (은퇴 — 앱 직접 연결 확인 후 서비스 삭제)
