# devtool_web — 기억할 내용

## 이 모듈의 정체 (다른 모듈과 다른 점)

- **서버 API 0개 · DB 0개 · 파일 저장 0개.** 스프링은 SPA 정적 서빙 + `/healthz` 만 담당.
  도구 전부가 브라우저 안에서만 동작하는 것이 제품의 핵심 약속(NFR-02) — CSP `connect-src 'none'` 으로 강제.
  **서버가 필요한 기능은 아무리 유용해도 넣지 않는다.**
- 그래서 **MySQL 스키마 없음 · Storage Bucket 없음 · `SPRING_DATASOURCE_*`/JWT env 없음.** 가장 싼 모듈.
- 프로파일 기본값이 local(`spring.profiles.default: local`) → **운영은 `SPRING_PROFILES_ACTIVE=prod` env 필수**
  (루트 start.sh 는 프로파일을 정해주지 않는다).

## Railway 서비스 env (이 3개가 전부)

```
APP_MODULE=devtool_web
SPRING_PROFILES_ACTIVE=prod
APP_PUBLIC_BASE_URL=https://<도메인>   # 미설정/localhost 면 fail-fast(RailwayDeploymentValidator)
```

## 배포 시 함정

- **배포 이미지는 node 없이 빌드된다** — 프론트를 고쳤으면 `:devtool_web:copyFrontendBuild` 로
  `src/main/resources/static` 을 갱신해 **커밋까지** 해야 반영된다.
  빠뜨리면 빌드는 성공하는데 사이트가 빈 화면(로그에 에러도 없음).
- 라우트 추가/삭제 시 5곳 동시 수정: `lib/tools.js` → `App.jsx` → `HomeController` → `SecurityConfig` → `sitemap.xml`.
  백엔드 두 곳이 어긋나면 **운영에서만** 403 (로컬 재현 안 됨). 잠그는 테스트: `tools.test.js` · `SpaRouteApiIntegrationTest`.
- 로컬 포트 8082 고정(application-local.yml) — 다른 모듈과 동시 기동 가능.

## 상태 (2026-08-31)

- total_module 편입 완료(설정 등록 + 루트 Gradle 9 빌드·테스트 검증). 남은 것: 커밋·Railway 서비스 생성·첫 배포.
- 진행 체크리스트: `devtool_web/total_module_편입_배포준비.md`
