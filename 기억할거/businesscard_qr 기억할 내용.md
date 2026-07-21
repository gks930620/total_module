# businesscard_qr 기억할 내용

> 나중에 다시 볼 때 헷갈리지 않도록 남기는 메모. (2026-07-21)

---

## 1. 명함 목록 캐시 — 현재는 **메모리만** 이다

### 현재 상태 (2026-07-21 기준)
- 목록 캐시 = **목록 화면의 메모리 변수**(`_businessCards`). 디스크 저장 없음.
- 동작: 로그인 후 목록 진입 시 **1페이지 API 1회** → 이후 무한스크롤로 다음 페이지만 추가.
  화면 이동(상세/수정/등록)해도 캐시 유지. **추가/수정/삭제는 API 성공 후 캐시만 갱신**(목록 재조회 없음) 후 맨 위(1페이지)부터 표시.
- **앱 완전 종료/로그아웃 → 캐시 무조건 소멸** (RAM이라 물리적으로 사라짐. "1주일 유지" 같은 건 디스크 저장이어야 가능).
- 즉 비용 = **앱 세션당 목록 API 1회 + 페이지 추가분**. 당겨서 새로고침만 수동 재조회.

### 캐시 전략 선택지 장단점

| 방식 | 앱 재시작 시 | API 호출 | 장점 | 단점 |
|---|---|---|---|---|
| **① 메모리만 (현재)** | 매번 1회 조회 | 세션당 1회 | 구현 단순, 낡을 위험 0 (항상 서버 최신) | 재시작마다 조회 + 콜드스타트 겹치면 첫 화면 느림 |
| **② TTL 디스크 캐시** (shared_preferences에 JSON+저장시각, 예: 7일) | TTL 내면 **조회 0** | ~7일에 1회 | API 호출 최소화 극대화. 구현 쉬움(JSON 문자열 하나) | 다른 기기에서 수정하면 낡음(당겨서 새로고침으로 해소). TTL 관리 필요 |
| **③ 스냅샷 + 백그라운드 갱신** (stale-while-revalidate) | 캐시 **즉시 표시** 후 뒤에서 조회·교체 | 세션당 1회 (①과 동일) | 콜드스타트에도 빈 화면 없이 즉시 목록 표시 (UX 최고). 낡음 자동 해소 | 호출 수는 안 줄어듦. "표시 후 바뀜" 깜빡임 가능 |
| **④ sqlite/hive 본격 로컬 DB** | 조회 0 + **오프라인 열람** | 최소 | 완전 오프라인 지원, 대량 데이터·부분 쿼리 가능 | **동기화 설계가 본격 과제**(로컬≠서버 충돌, 무효화 시점). 이 규모(명함 몇 장)엔 과함 |

### 이 앱 특성 (판단 근거)
- **내 명함은 이 앱에서만 생성/수정/삭제** → 서버가 몰래 바뀔 일이 거의 없어 로컬 캐시가 낡을 위험 낮음.
  낡는 유일한 경우 = **다른 폰에서 같은 계정으로 수정** → 당겨서 새로고침(이미 있음)으로 해소 가능.
- 첫 조회의 실제 병목은 목록 API가 아니라 **App Sleeping 콜드스타트**(서버 깨우기 10~30초).
- **이미지 캐시는 이미 ②방식** — `ImageCacheService`가 디스크에 7일 TTL로 캐시 중 (목록에 ②를 얹을 때 참고할 선례).

### 결론/방향
- 지금 규모엔 **① 유지로 충분**. API 호출을 더 줄이고 싶어지면 **②(TTL 디스크)**, 첫 화면 체감을 올리고 싶으면 **③**.
- **④(sqlite)는 "오프라인에서도 명함 열람" 요구가 진짜 생길 때만** — 동기화 비용이 이득보다 큼.

---

## 2. 표시명(display_name) — 코드에서는 삭제 완료, DB 컬럼은 남아있음

- 2026-07-21 커밋 `de909c7`에서 **코드 전부 삭제됨**: 앱(폼/모델/목록·상세 표시) + 백엔드(엔티티/요청·응답 DTO/테스트). 이름 표시는 전부 성명(full_name)만 사용.
- ⚠️ **Railway DB의 `business_cards.display_name` 컬럼은 남아있을 수 있다** — `ddl-auto: update`는 컬럼 추가만 하고 **drop은 안 하기 때문**. 동작엔 지장 없음(그냥 안 쓰는 컬럼).
- 나중에 정리하려면 DBeaver로 total_mysql(`businesscard_qr` 스키마) 접속 후:
  ```sql
  ALTER TABLE business_cards DROP COLUMN display_name;
  ```

---

## 2-1. 배포·운영 현황 (2026-07-21 기준) ⭐ 세션 이어받을 때 여기부터

### 배포 상태
- **businesscard_qr 백엔드 = Railway 배포 완료 + 검증됨.** `GET /healthz` UP, `/swagger-ui.html` 열림, 인증 API 토큰 없이 호출 시 401 — 정상.
- 서비스 공개 도메인: `https://businesscardqr-production.up.railway.app` (앱 `.env`의 `BACKEND_BASE_URL` = 서버 `APP_PUBLIC_BASE_URL` = 이 값, 셋 일치 확인됨).
- 버킷 `businesscard_qr_bucket`(region sjc) 생성·자격증명 발급 완료 → 서버 env `BUCKET_*`에 실제 값 입력됨.
  - (참고: 버킷 자격증명 생성이 한동안 "unexpected error"로 실패했는데 **Railway 플랫폼 문제**였고 이후 해결됨.)
- **비밀값(JWT_SECRET, 버킷 SECRET_ACCESS_KEY)은 Railway env에만 있음 — 절대 커밋 금지.** `.env`도 gitignore.
- Railway CLI 설치·링크됨(`railway` v5.26.1, project total_module / env production). 로그 확인: `railway logs -s businesscard_qr -d --lines 50`.

### 카카오 로그인 운영지식 ⭐ (문서 없으면 반드시 다시 헤맴)
- **앱 ID = `1315157`** (숫자). 서버 env `APP_KAKAO_EXPECTED_APP_ID`에 설정 → **미설정 시 부팅 차단**(우리가 fail-fast로 강제함). 앱 ID는 공개값이라 노출 무방.
- 앱은 **네이티브 앱 키**(`.env`의 `KAKAO_NATIVE_APP_KEY`)로 로그인, 서버는 **앱 ID**로 토큰 검증 — 둘은 같은 카카오 앱(1315157)의 다른 값.
- **키 해시(Key Hash) 등록 필수** — 안 하면 로그인 시 `misconfigured / Android keyHash validation failed`.
  - 키 해시는 **코드에 없다.** 앱을 서명한 keystore에서 계산되는 값 → **카카오 개발자센터 → 앱(1315157) → 플랫폼 Android**에 등록만 하면 됨.
  - 패키지명: `com.example.businesscard_qr`
  - **현재 등록된 것 = 디버그 키 해시** `MXElJ76jlbtx+1sVEPo04ud1Mhk=` (이 PC의 `~/.android/debug.keystore` 기준).
  - ⚠️ **키 해시는 빌드 서명마다 다르다** — 다른 PC에서 빌드하거나 **릴리스 APK로 배포하면 그 keystore의 키 해시를 새로 뽑아 카카오에 추가**해야 함. (릴리스 배포 시 꼭 기억)
  - 디버그 키 해시 재계산(openssl 없이):
    ```powershell
    $ks="$env:USERPROFILE\.android\debug.keystore"; $kt="C:\Users\gks93\.jdks\corretto-17.0.19\bin\keytool.exe"
    $sha1=(( & $kt -list -v -alias androiddebugkey -keystore $ks -storepass android -keypass android | Select-String 'SHA1:') -replace '.*SHA1:\s*','') -replace '[^0-9A-Fa-f]',''
    $b=for($i=0;$i -lt $sha1.Length;$i+=2){[Convert]::ToByte($sha1.Substring($i,2),16)}; [Convert]::ToBase64String([byte[]]$b)
    ```

### 아직 안 한 것 (pending)
- [ ] 폰에서 **vCard 연락처 저장**(CRLF 수정 후 — 예전 받아둔 vcf는 LF라 **새 QR로** 테스트), **목록 페이징**(20개↑ 무한스크롤), **명함 삭제** 재확인
- [ ] Railway DB의 `business_cards.display_name` 컬럼 수동 DROP (§2 참고, DBeaver)
- [ ] (릴리스 배포 시) 릴리스 키 해시 카카오 등록 + swagger 접근 제한(배포가이드 §9)

---

## 3. 같은 날 같이 반영된 것 (참고)

- **vCard 줄바꿈 CRLF 수정**(`08ffd92`) — vcf 다운로드 후 연락처 저장 안 되던 문제의 유력 원인 수정. **폰에서 새 QR로 재테스트 필요** (예전에 받아둔 vcf는 여전히 LF 파일).
- **목록 페이징 도입**으로 목록 API 응답이 배열 → PageResponse(content/last)로 변경됨 — **앱과 백엔드가 같이 배포되어야 함** (한쪽만 옛 버전이면 목록 로딩 실패).
- 명함 **삭제 기능 신규 추가** (상세 화면 🗑️ → 확인 → DELETE → 캐시에서 제거).
- 디버그 배너 제거, 목록 새로고침 버튼 제거(캐시 전략상 불필요).
- 남은 과제(스웨거 공개, /uploads 공개 등)는 [`오류해결/businesscard_qr_배포가이드_2026-07-15.md`](../오류해결/businesscard_qr_배포가이드_2026-07-15.md) §9 참고.
