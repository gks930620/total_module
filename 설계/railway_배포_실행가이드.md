# Railway 배포 실행 가이드 (처음부터)

이 문서는 Railway를 처음 쓰는 상황을 기준으로 작성했습니다.  
아래 순서대로 그대로 진행하면 `total_module` 저장소를 Railway에 배포할 수 있습니다.

배포 대상 서비스는 총 3개입니다.

1. `mysql` (DB)
2. `businesscard_qr` (실제 API 서버)
3. `dist_api_gateway` (외부 진입점, `businesscard_qr`로 프록시)

---

## 0. 시작 전 핵심 규칙

1. 환경변수 값에 따옴표(`"`) 넣지 않습니다.
2. `<...>` 형태 예시는 반드시 실제 값으로 바꿉니다.
3. `businesscard_qr`, `dist_api_gateway` 둘 다 같은 저장소(`gks930620/total_module`)를 사용합니다.
4. Root Directory는 기본값(비워둠) 또는 `/`로 둡니다.
5. Custom Build Command/Start Command는 비워둡니다.

---

## 1. Railway 프로젝트 생성 (옵션이 많이 뜰 때)

중요: 이 단계에서는 **코드 배포를 하지 않고 프로젝트 껍데기만 먼저 만듭니다.**

1. Railway 로그인 후 대시보드로 이동
2. `New Project` 클릭
3. 여러 선택지 중에서 **`Empty Project`만 선택**
   - `Deploy from GitHub Repo`는 이 단계에서 선택하지 않음
   - Template/Database 등 다른 항목도 이 단계에서 선택하지 않음
4. 프로젝트 생성 완료 확인
5. 프로젝트 이름 변경(선택)
   - 프로젝트 상단 이름 클릭 -> `Rename` -> 예: `total-module-prod`

실수 복구:

1. 만약 여기서 `Deploy from GitHub Repo`를 눌러 서비스가 자동 생성됐다면, 삭제하지 않아도 됩니다.
2. 그 자동 생성 서비스를 `businesscard_qr`로 사용하고, 이후 단계에서 `dist_api_gateway`만 추가 생성하면 됩니다.

---

## 2. MySQL 서비스 생성

1. 프로젝트 캔버스에서 `+ New`
2. `Database` 선택
3. `MySQL` 선택
4. 서비스 이름을 `mysql`로 지정 (권장)
5. 생성 완료 후 `mysql` 서비스의 `Variables` 탭에서 아래 키들이 자동 생성되어 있는지 확인
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLDATABASE`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`

참고: DB 서비스는 보통 추가 수정이 필요 없습니다.

---

## 3. businesscard_qr 서비스 생성

1. 프로젝트 캔버스에서 `+ New`
2. `Service` 선택
3. `GitHub Repo` 선택
4. 저장소 `gks930620/total_module` 선택
5. 생성된 서비스 이름을 `businesscard_qr`로 변경
6. `Settings` `확인`
   - Source Repo: `gks930620/total_module`
   - Branch: `master`
   - Root Directory: 비워둠(기본) 또는 `/`
   - Custom Build Command: 비워둠
   - Start Command: 비워둠
   - Healthcheck Path: `/healthz` 권장
7. `Networking`에서 `Public Networking`의 `Generate Domain` 클릭
8. 생성된 도메인 URL 복사해서 메모 (`BIZ_URL`)
근데 보통 다른부분 잘 되어야 도메인 생성되니까 일단 킾



### businesscard_qr Variables 입력
`businesscard_qr` 서비스 `Variables` 탭에 아래 값 입력:

```env
APP_MODULE=businesscard_qr
APP_JWT_SECRET=5f25604306b1eb1f3cb60cf9ce6c9676e3024567d2b75f6ee23877ae95636b84
SPRING_DATASOURCE_DRIVER=org.mariadb.jdbc.Driver
SPRING_DATASOURCE_URL=jdbc:mariadb://${{mysql.MYSQLHOST}}:${{mysql.MYSQLPORT}}/${{mysql.MYSQLDATABASE}}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC
SPRING_DATASOURCE_USERNAME=${{mysql.MYSQLUSER}}
SPRING_DATASOURCE_PASSWORD=${{mysql.MYSQLPASSWORD}}
SPRING_JPA_DDL_AUTO=update
```
${{mysql.MYSQLPASSWORD}} 은 내 mysql서비스의 환경변수값 읽는거 

중요:

1. `mysql`은 DB 서비스명입니다. 실제 서비스명이 다르면 그 이름으로 바꿔야 합니다.
2. 가장 안전한 방법은 입력창에서 `${{`를 입력한 뒤 자동완성으로 삽입하는 것입니다.

---

## 4. dist_api_gateway 서비스 생성

1. 프로젝트 캔버스에서 `+ New`
2. `Service` 선택
3. `GitHub Repo` 선택
4. 저장소 `gks930620/total_module` 선택
5. 생성된 서비스 이름을 `dist_api_gateway`로 변경
6. `Settings` 확인
   - Source Repo: `gks930620/total_module`
   - Branch: `master`
   - Root Directory: 비워둠(기본) 또는 `/`
   - Custom Build Command: 비워둠
   - Start Command: 비워둠
   - Healthcheck Path: `/healthz` 권장
7. `Networking`에서 `Public Networking`의 `Generate Domain` 클릭
8. 생성된 도메인 URL 복사해서 메모 (`GW_URL`)

### dist_api_gateway Variables 입력

`dist_api_gateway` 서비스 `Variables` 탭에 아래 값 입력:

```env
APP_MODULE=dist_api_gateway
APP_GATEWAY_BUSINESS_QR_URL=https://<businesscard_qr_실제도메인>
APP_GATEWAY_다른서비스_URL=https://<다른서비스_실제도메인>
```
이 값은 `businesscard_qr` 서비스의 실제 Public Domain URL입니다.


---

## 5. CORS 변수 추가 (businesscard_qr)

`businesscard_qr` 서비스 `Variables`에 아래 값 추가:

```env
APP_CORS_ALLOWED_ORIGINS=https://<dist_api_gateway_실제도메인>
```

예시:

```env
APP_CORS_ALLOWED_ORIGINS=https://gateway-xxxx.up.railway.app
```

---

## 6. 배포 순서 (중요)

1. `businesscard_qr` 먼저 Deploy
2. `businesscard_qr` 정상 기동 확인
3. `dist_api_gateway` Deploy

배포가 자동으로 안 되면 각 서비스 `Deployments` 탭에서 `Redeploy`를 실행합니다.

---

## 7. 최종 확인 URL

1. `https://<BIZ_URL>/healthz`
2. `https://<GW_URL>/healthz`
3. `https://<GW_URL>/swagger-ui.html`

정상 기대값:

1. healthz는 `status: UP`
2. gateway swagger 화면이 열림

---


raiwlay 설정에 맞게 프로젝트 설정파일들 수정
커밋 푸쉬 







