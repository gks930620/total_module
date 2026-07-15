# total_module

로컬에서 완성한 스프링부트 프로젝트들을 모아 **하나의 Railway 프로젝트로 통합 배포**하는 저장소.
아키텍처 기준: [total_설계/아키텍처_및_편입기준.md](total_설계/아키텍처_및_편입기준.md)

```
저장소 1개 = Railway 프로젝트 1개
빌드: 루트 단일 Dockerfile → 이미지 1개 (모든 모듈 jar 포함)
실행: 모듈 1개 = Railway 서비스 1개 (APP_MODULE로 선택)
접근: 각 서비스가 자기 공개 URL로 직접 트래픽 수신 (게이트웨이 없음)
```

## 모듈

| 폴더 | 정체 | 배포 |
|------|------|------|
| `businesscard_qr/` | 명함 QR API 서버 (Spring Boot) | Railway 서비스 `APP_MODULE=businesscard_qr` |
| `businesscard_qr_app/` | Flutter 앱 (Gradle 멤버 아님) | APK 별도 배포 — 서버 이미지에 포함 안 됨 |

## Railway 배포

서비스별 환경변수와 절차: [total_설계/railway_배포_및_비용.md](total_설계/railway_배포_및_비용.md)

핵심 (businesscard_qr 서비스):

- `APP_MODULE=businesscard_qr`
- `SPRING_DATASOURCE_URL` / `USERNAME` / `PASSWORD` — **필수.** 없으면 부팅 실패(fail-fast, H2 인메모리 데이터 소실 방지)
- `APP_JWT_SECRET` (32+ chars) — 기본값이면 배포 차단
- `APP_PUBLIC_BASE_URL=https://<이 서비스의 공개 도메인>` — QR/이미지/다운로드 절대 URL 기준
- `BUCKET_ENDPOINT` / `BUCKET_ACCESS_KEY_ID` / `BUCKET_SECRET_ACCESS_KEY` / `BUCKET_NAME` — 업로드 이미지를 Railway Storage Bucket(S3)에 저장(재배포에도 보존). 미설정 시 로컬 디스크 폴백
- 헬스체크: `GET /healthz` (railway.toml)

## 새 모듈 추가 절차

[total_설계/아키텍처_및_편입기준.md](total_설계/아키텍처_및_편입기준.md) §4 참고. 요약:

1. 프로젝트 폴더를 루트에 추가
2. `settings.gradle`에 `include '<module>'`
3. `Dockerfile`의 `[새 모듈 추가 시]` 주석 위치 3곳 + start.sh 허용 목록에 추가
4. Railway 서비스 생성 (`APP_MODULE=<module>`) + Generate Domain

## Local run

```bash
./gradlew :businesscard_qr:bootRun   # 8081 (로컬 기본: H2 인메모리)
```
