# 기존 코드 대비 React 전환 변경요약

> 최신화: 2026-07-06 — 실제 코드(백엔드 `com.doll.gacha`, 프론트 `frontend/src`) 기준으로 전면 정정.
> 이전 버전에 있던 채팅(`/rooms`, `stomp`)·`HomePage.jsx`·`/api/communities` 기술은 **실제와 달라 제거**했습니다.

## 한 줄 요약
- **HTML만 바뀐 게 아닙니다.**
- 화면 렌더링 방식(Thymeleaf + 페이지별 JS)에서 **React SPA 구조**로 바뀌었고, 빌드/배포 흐름도 함께 바뀌었습니다.
- Thymeleaf 템플릿(`src/main/resources/templates`)은 **완전히 제거**되었습니다.

---

## 1. 안 바뀐 것 (기능/백엔드 관점)
- REST API 계약은 기존 도메인 구조를 유지
  - 실제 경로: `/api/community`, `/api/comments/**`, `/api/files/**`, `/api/doll-shops/**`, `/api/reviews/**`, `/api/my/info`
- 보안 방식 유지
  - JWT HttpOnly 쿠키, refresh 재발급(`/api/refresh/reissue`) 흐름 유지
- 도메인/서비스 계층 유지
  - `community`, `community.comment`, `dollshop`, `review`, `file`, `jwt` 패키지 구조 유지
  - ※ 채팅(stomp)은 **미구현**입니다(향후 확장 항목).
- 즉, **기능 자체(커뮤니티/댓글/파일/매장/리뷰/인증)는 동일**하게 동작하도록 유지

## 2. 바뀐 것 (핵심)

### 2-1. 화면 구성 방식
- 이전:
  - `templates/*.html` + `templates/layout/header.html` 내 공통 JS
  - 페이지마다 직접 DOM 조작, `fetch/ajax` 호출
- 현재:
  - `frontend/src`의 React 컴포넌트(`pages`, `components`)에서 렌더링
  - 라우팅은 `react-router-dom`으로 처리 (`frontend/src/App.jsx`)

### 2-2. 서버 라우팅 방식
- 이전:
  - URL마다 각 Thymeleaf 템플릿 반환
- 현재:
  - `HomeController`가 주요 페이지 URL을 `forward:/index.html`로 전달
  - React Router가 실제 페이지를 결정

### 2-3. API 호출 방식(프론트 내부)
- 이전:
  - 템플릿 JS에서 `authFetch`, `callApi` 등을 전역 함수로 사용
- 현재:
  - `frontend/src/lib/http.js`로 공통화
  - `callApi`, `callPublicApi`, `authFetch`, `toApiError`를 모듈 방식으로 사용
  - 인증 상태는 `AuthContext`로 관리

### 2-4. 빌드/배포 방식 (단일 서버)
- 이전:
  - Spring 템플릿 중심 서빙
- 현재:
  - Gradle이 프론트 빌드까지 포함 (`build.gradle`의 `npmInstall → npmBuild → copyFrontend`)
  1. `frontend npm install`
  2. `frontend npm run build`
  3. `frontend/dist`를 `src/main/resources/static`으로 복사
  - 결과적으로 여전히 `localhost:8080` 단일 서버로 동작

---

## 3. 페이지별 변경 매핑 (기존 -> 현재)

실제 `frontend/src/App.jsx` 라우트 기준입니다.

| URL | 기존(Thymeleaf) | 현재(React) |
|---|---|---|
| `/`, `/map` | `templates/map.html` | `pages/MapPage.jsx` |
| `/login` | `templates/login.html` | `pages/LoginPage.jsx` |
| `/signup` | `templates/signup.html` | `pages/SignupPage.jsx` |
| `/mypage` | `templates/mypage.html` | `pages/MyPage.jsx` (인증 필요) |
| `/community` | `templates/community/list.html` | `pages/community/CommunityListPage.jsx` |
| `/community/detail` | `templates/community/detail.html` | `pages/community/CommunityDetailPage.jsx` |
| `/community/write` | `templates/community/write.html` | `pages/community/CommunityWritePage.jsx` (인증 필요) |
| `/community/edit` | `templates/community/edit.html` | `pages/community/CommunityEditPage.jsx` (인증 필요) |
| `/doll-shop/list` | `templates/doll-shop/list.html` | `pages/dollshop/DollShopListPage.jsx` |
| `/doll-shop/detail` | `templates/doll-shop/detail.html` | `pages/dollshop/DollShopDetailPage.jsx` |
| `/review/write` | `templates/review/write.html` | `pages/review/ReviewWritePage.jsx` (인증 필요) |
| `/review/edit` | `templates/review/edit.html` | `pages/review/ReviewEditPage.jsx` (인증 필요) |
| `/custom-oauth2/login/success` | `templates/oauth2-redirect.html` | `pages/OAuth2RedirectPage.jsx` (레이아웃 없음) |

추가 호환:
- `/community/list`는 React에서 `/community`로 리다이렉트되도록 처리(`App.jsx`).

> 참고: 채팅(`/rooms`, `/rooms/{roomId}`) 페이지는 존재하지 않습니다(미구현).

---

## 4. 현재 시점 정리
- **사용자 입장:** 같은 기능을 같은 서버에서 사용
- **개발자 입장:** 화면 코드가 React로 통합되어 재사용/유지보수성이 높아짐
- 템플릿 파일(`src/main/resources/templates`)은 **삭제 완료**, 메인 렌더링 경로는 React SPA

---

## 5. 왜 이렇게 바꿨는가
- 페이지별 JS 분산/중복 감소
- 인증 상태, API 에러 처리, 라우팅을 한 구조로 통합
- 이후 기능 추가 시 템플릿+스크립트 분산보다 React 컴포넌트 기반이 변경 추적이 쉬움
