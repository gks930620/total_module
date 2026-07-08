# total_module

> **⚠️ 2026-07-08 아키텍처 방향 전환**: dist_api_gateway는 **은퇴 예정**이며, 각 모듈이 자기 공개 URL로 직접 트래픽을 받는 방향으로 확정됨.
> 기준 문서: [설계/아키텍처_방향결정.md](설계/아키텍처_방향결정.md) — 아래 게이트웨이 관련 내용은 청산 작업 완료 시 삭제 예정.

`total_module` is a monorepo with two backend modules:

- `businesscard_qr`: main business-card API server
- `dist_api_gateway`: minimal gateway server that proxies to `businesscard_qr`

## Railway deployment

This repo uses a single root `Dockerfile`.  
Each Railway service selects which jar to run with `APP_MODULE`.

### Railway setup order

1. Create service `businesscard_qr` from this repository.
2. In `Settings > Root Directory`, set `/` (repo root).
3. Set Variables:
   - `APP_MODULE=businesscard_qr`
   - `APP_JWT_SECRET=<32+ chars>`
   - `SPRING_DATASOURCE_URL=...`
   - `SPRING_DATASOURCE_USERNAME=...`
   - `SPRING_DATASOURCE_PASSWORD=...`
   - `SPRING_JPA_DDL_AUTO=update`
   - `APP_STORAGE_TYPE=db`  # 업로드 이미지를 Railway MySQL에 저장(재배포에도 보존). 기본값도 `db`.
4. Deploy and copy service URL (`https://...up.railway.app`).
5. Create service `dist_api_gateway` from the same repository.
6. In `Settings > Root Directory`, set `/` (repo root).
7. Set Variables:
   - `APP_MODULE=dist_api_gateway`
   - `APP_GATEWAY_BUSINESS_QR_URL=<businesscard_qr service URL>`
8. Deploy and use `dist_api_gateway` URL as client base URL.

### Service 1: `businesscard_qr`

- `APP_MODULE=businesscard_qr`
- Required env examples:
  - `SPRING_DATASOURCE_URL`
  - `SPRING_DATASOURCE_USERNAME`
  - `SPRING_DATASOURCE_PASSWORD`
  - `SPRING_JPA_DDL_AUTO=update`
  - `APP_JWT_SECRET` (32+ chars)
  - `APP_CORS_ALLOWED_ORIGINS=https://<gateway-service>.up.railway.app`
  - `APP_STORAGE_TYPE=db` (업로드 이미지 저장소. `db`=MySQL 영구 저장(기본), `local`=로컬 디스크)
  - (선택) `SPRING_H2_CONSOLE_ENABLED`는 기본 `false`. SQL 로그도 기본 off.

### Service 2: `dist_api_gateway`

- `APP_MODULE=dist_api_gateway`
- Required env examples:
  - `APP_GATEWAY_BUSINESS_QR_URL=https://<businesscard-service>.up.railway.app`
  - Legacy fallback also supported: `APP_GATEWAY_TARGET_BASE_URL=...`

### Health check

- `railway.toml` health check path is `/healthz` for both modules.
- `businesscard_qr` and `dist_api_gateway` both expose `GET /healthz`.

## Local run (monorepo root)

```bash
./gradlew :businesscard_qr:bootRun
./gradlew :dist_api_gateway:bootRun
```

Default ports:

- `businesscard_qr`: `8081`
- `dist_api_gateway`: `8080`
