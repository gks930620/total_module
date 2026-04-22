# CSR 프로젝트 구조 정리

> Spring Boot + Thymeleaf(페이지 서빙) + JavaScript(CSR) + JWT + OAuth2 + WebSocket 채팅  
> 페이지는 Thymeleaf가 빈 HTML 제공, 데이터는 JS에서 REST API 호출 (CSR 방식)

---

## 아키텍처 원칙

### Layer Architecture
```
Controller → Service → Repository
```

| 계층 | 역할 | 규칙 |
|------|------|------|
| **Controller** | 요청/응답 처리 | Repository 직접 사용 ❌, Entity 사용 ❌ |
| **Service** | 비즈니스 로직 | Entity ↔ DTO 변환 담당 |
| **Repository** | 데이터 접근 | QueryDSL에서 DTO 직접 반환 가능 |

- Controller에서 Repository 호출 금지
- DB조회나 해당 domain에 관한 로직은 Service, 파일이나 날짜 등 공통기능은 Util로 이름짓기

### API 설계 규칙 (CSR)
- **1 API = 1 Controller 메소드 = 1 Service 메소드**
- 프론트엔드(JS)에서 진행 흐름을 받고 API 여러번 호출하는 방식
- API 여러번 호출이 부담될 때만 Facade 패턴 고려
- Service 메소드가 비슷하면 → private 공통 메소드로 추출
- SELECT만 하는 경우 → QueryDSL에서 DTO 직접 반환 권장

### SSR과의 차이
| 항목 | SSR | CSR (이 프로젝트) |
|------|-----|-----|
| 데이터 전달 | Controller → Model → Thymeleaf | JS → fetch API → JSON 응답 |
| 인증 | Session + `sec:authorize` | JWT (Cookie) + JS에서 `authFetch` |
| 로그인 정보 | `model.addAttribute("user", ...)` | `authFetch('/api/users/me')` |
| 페이지 렌더링 | 서버에서 HTML 완성 | 빈 HTML + JS에서 DOM 조작 |
| 로그인/비로그인 분기 | `sec:authorize="isAuthenticated()"` | JS에서 API 응답으로 판단 |

---

## 📁 패키지 구조

```
com.test.test/
├── DemoApplication.java              # 메인 애플리케이션
├── HomeController.java               # 페이지 라우팅 (빈 HTML 제공)
│
├── common/                           # 공통 모듈
│   ├── config/
│   │   ├── CorsConfig.java           # CORS 설정
│   │   ├── QuerydslConfig.java       # QueryDSL 설정
│   │   └── WebConfig.java            # 리소스 핸들러, Pageable 설정
│   ├── dto/
│   │   ├── ApiResponse.java          # 성공 응답 래퍼
│   │   ├── ErrorResponse.java        # 에러 응답 래퍼
│   │   └── PageResponse.java         # 페이징 응답 래퍼
│   └── exception/
│       ├── GlobalExceptionHandler.java  # 전역 예외 처리
│       ├── BusinessException.java       # 커스텀 예외 부모
│       ├── EntityNotFoundException.java # 404
│       ├── AccessDeniedException.java   # 403
│       ├── DuplicateResourceException.java # 409
│       └── BusinessRuleException.java   # 400
│
├── jwt/                              # Security (JWT + OAuth2)
│   ├── JwtUtil.java                  # JWT 생성/검증 유틸
│   ├── config/
│   │   └── SecurityConfig.java       # Security 설정 (필터, 경로 권한)
│   ├── filter/
│   │   ├── JwtLoginFilter.java       # 로그인 요청 처리 (POST /api/login)
│   │   └── JwtAccessTokenCheckAndSaveUserInfoFilter.java  # 매 요청 토큰 검증
│   ├── handler/
│   │   ├── OAuth2LoginSuccessHandler.java   # OAuth2 로그인 성공 → JWT 발급
│   │   └── CustomLogoutSuccessHandler.java  # 로그아웃 처리
│   ├── controller/
│   │   ├── JoinController.java       # 회원가입 API
│   │   ├── UserController.java       # 내 정보 API (/api/users/me)
│   │   ├── RefreshController.java    # 토큰 재발급 API
│   │   ├── Oauth2LoginController.java # OAuth2 로그인 시작 (웹)
│   │   └── AppOAuth2Controller.java  # OAuth2 로그인 (앱 네이티브)
│   ├── service/
│   │   ├── CustomUserDetailsService.java  # 일반 로그인 시 DB 조회
│   │   ├── CustomOAuth2UserService.java   # OAuth2 로그인 시 DB 조회/저장
│   │   ├── JoinService.java          # 회원가입 로직
│   │   └── RefreshService.java       # Refresh Token DB 관리
│   ├── model/
│   │   ├── CustomUserAccount.java    # UserDetails + OAuth2User 통합
│   │   ├── UserDTO.java              # 사용자 DTO
│   │   ├── JoinDTO.java              # 회원가입 요청 DTO
│   │   └── OAuthProvider.java        # OAuth2 제공자별 로직 (ENUM)
│   ├── entity/
│   │   ├── UserEntity.java           # 사용자 엔티티
│   │   └── RefreshEntity.java        # Refresh Token 엔티티
│   └── repository/
│       ├── UserRepository.java
│       ├── RefreshRepository.java
│       └── InMemoryAuthorizationRequestRepository.java  # OAuth2 state 저장
│
├── community/                        # 게시판
│   ├── CommunityController.java      # 게시글 CRUD API
│   ├── CommunityService.java         # 게시글 비즈니스 로직
│   ├── CommunityEntity.java          # 게시글 엔티티
│   ├── dto/
│   │   ├── CommunityDTO.java         # 게시글 응답 DTO
│   │   ├── CommunityCreateDTO.java   # 게시글 작성 요청 DTO
│   │   └── CommunityUpdateDTO.java   # 게시글 수정 요청 DTO
│   ├── repository/
│   │   ├── CommunityRepository.java
│   │   ├── CommunityRepositoryCustom.java   # QueryDSL 인터페이스
│   │   └── CommunityRepositoryImpl.java     # QueryDSL 구현
│   └── comment/                      # 댓글
│       ├── CommentController.java    # 댓글 CRUD API
│       ├── CommentService.java
│       ├── CommentEntity.java
│       ├── dto/
│       └── repository/
│
├── file/                             # 파일 업로드
│   ├── controller/
│   │   └── FileController.java       # 업로드/다운로드/이미지서빙 API
│   ├── service/
│   │   └── FileService.java
│   ├── entity/
│   │   └── FileEntity.java
│   ├── strategy/                     # Strategy Pattern
│   │   ├── FileStorageStrategy.java  # 인터페이스
│   │   ├── LocalFileStorage.java     # 로컬 저장
│   │   └── SupabaseFileStorage.java  # 클라우드 저장
│   ├── dto/
│   ├── repository/
│   └── util/
│
└── stomp/                            # 실시간 채팅 (WebSocket)
    ├── config/
    │   ├── WebSocketConfig.java      # STOMP 엔드포인트/브로커 설정
    │   └── WebSocketEventListener.java  # 입장/퇴장 이벤트
    ├── interceptor/
    │   ├── HttpHandshakeInterceptor.java  # HTTP 핸드셰이크 시 쿠키→JWT 추출
    │   └── JwtChannelInterceptor.java     # STOMP CONNECT 시 JWT 인증
    ├── controller/
    │   ├── ChatController.java       # @MessageMapping 메시지 핸들러
    │   └── RoomController.java       # 채팅방 목록/상세 API
    ├── service/
    │   └── RoomService.java
    ├── entity/
    │   └── RoomEntity.java
    ├── model/
    │   ├── ChatMessage.java
    │   └── RoomDTO.java
    └── repository/
        └── RoomRepository.java
```

---

## Entity와 DTO

### 변환 규칙
```java
// DTO → Entity : DTO에서 toEntity()
Entity entity = dto.toEntity();

// Entity → DTO : DTO에서 from(entity)
DTO dto = DTO.from(entity);
```

- **Entity** — DB 매핑 + 비즈니스 편의 메소드 (상태 변경). 편의메소드에서 exception 발생시켜도 공통처리 됨
- **DTO** — 변환 메소드 + API 요청/응답. 기본적으로 공통DTO 쓰다가 새로운 DTO 필요하면 그때그때 만들기

### DTO 분리 (Security)

| DTO | 역할 | 사용 위치 |
|-----|------|-----------|
| `UserDTO` | 사용자 정보 전달 (id, username, nickname, email, roles) | CustomUserAccount 내부 |
| `JoinDTO` | 회원가입 요청 (username, password, nickname, email) | JoinController |
| `CustomUserAccount` | UserDetails + OAuth2User 통합 — **UserDTO를 composition** | Security 전반 |

---

## 📤 응답 표준화

### 성공 응답
```java
ResponseEntity<ApiResponse<T>>
// 사용: return ResponseEntity.ok(ApiResponse.success("조회 성공", data));
```
- 현재 구현은 성공 응답을 `ApiResponse` 형식으로 통일함.

### 페이징 응답
```java
PageResponse<T>  // Page<>의 필요한 필드만 추출
```

### 에러 응답
```java
ErrorResponse  // 모든 에러 상황에서 일관된 JSON 구조
// { success: false, message: "...", errorCode: "...", timestamp: "..." }
```

### HTTP 상태 코드
| 코드 | 사용 | 에외 클래스 |
|------|------|-------------|
| 400 | 비즈니스 규칙 위반 | `BusinessRuleException` |
| 401 | 인증 필요 / 토큰 만료 | SecurityConfig `authenticationEntryPoint` |
| 403 | 권한 없음 (작성자 아님) | `AccessDeniedException` |
| 404 | 리소스 없음 | `EntityNotFoundException` |
| 409 | 중복 리소스 | `DuplicateResourceException` |

---

## 🔐 Security — JWT + OAuth2 (쿠키 방식)

### 인증 구조
```
브라우저: JWT를 HttpOnly 쿠키에 저장 (JS에서 접근 불가 → XSS 안전)
앱:      JWT를 JSON 응답으로 받아 앱 내부 저장소에 저장
```

### JWT 구조
| 토큰 | 만료 | 저장 | 용도 |
|------|------|------|------|
| Access Token | 30분 | 쿠키 `access_token` | API 인증 |
| Refresh Token | 4시간 | 쿠키 `refresh_token` + DB | Access Token 재발급 |

### 로그인 정보 사용
```java
// Controller에서
@AuthenticationPrincipal CustomUserAccount userAccount
userAccount.getUsername();  // 사용자 ID
userAccount.getUserDTO();  // 전체 사용자 정보
```

### 일반 로그인 흐름
```
POST /api/login (JSON: {username, password})
  → JwtLoginFilter가 가로챔
  → AuthenticationManager → CustomUserDetailsService.loadUserByUsername()
  → BCrypt 비밀번호 비교
  → 성공: Access/Refresh Token 생성 → 쿠키 설정 (200 응답)
  → 실패: 401 응답 (JSON)
```

### OAuth2 로그인 흐름 (카카오/구글)
```
1. 브라우저: <a href="/custom-oauth2/login/web/kakao"> 클릭
2. Oauth2LoginController → state 생성 → 카카오 인증 URL로 리다이렉트
3. 카카오 로그인 완료 → /login/oauth2/code/kakao 콜백
4. Spring Security가 자동으로 CustomOAuth2UserService 호출
5. OAuth2LoginSuccessHandler → JWT 발급 → 쿠키 설정 → / 리다이렉트
```

### 매 요청 인증 (JwtAccessTokenCheckAndSaveUserInfoFilter)
```
매 HTTP 요청 → 쿠키/헤더에서 access_token 추출
  → null이면 비인증 상태로 통과
  → refresh 토큰이면 통과 (/api/tokens/refresh로 갈 것)
  → access 토큰 만료면 ERROR_CAUSE="토큰만료" → authenticationEntryPoint에서 401 응답
  → 유효하면 SecurityContext에 인증정보 저장 → 로그인 상태로 통과
```

### 토큰 재발급 (RefreshController)
```
POST /api/tokens/refresh (쿠키에서 refresh_token 자동 전송)
  → 존재 확인 (DB) → 만료 검증 → 기존 삭제 (Rotation) → 새 토큰 발급
```

### SecurityConfig 경로 규칙
```
permitAll()     → 페이지 URL, 정적 리소스, 공개 API, WebSocket
                  GET /api/communities, GET /api/communities/{id}
authenticated() → /api/logout, /api/users/me, /api/rooms, /api/rooms/**,
                  POST/PUT/DELETE /api/communities/**, /api/comments/**, /api/files
anyRequest()    → permitAll() (개발 편의, 운영 시 변경 고려)
```

### 보안 개선사항 (적용됨)
- `InMemoryAuthorizationRequestRepository`: `new Thread()` → `ScheduledExecutorService`
- `JwtUtil.getTokenType()`: `JwtException | IllegalArgumentException` catch 추가
- `RefreshController`: 만료 검증 → 삭제 순서 변경 (만료 시 명확한 에러)
- `CustomOAuth2UserService` / `OAuthProvider`: `{noop}oauth2user` → `PasswordEncoder + UUID`
- `JwtAccessTokenCheckAndSaveUserInfoFilter`: `"refresh".equals(tokenType)` NPE 방지
- 쿠키 `secure` 설정: `app.cookie.secure` 환경변수로 분기 (로컬 false, 운영 true)
  - `OAuth2LoginSuccessHandler`, `JwtLoginFilter`, `CustomLogoutSuccessHandler` 모두 적용

---

## 💬 실시간 채팅 (STOMP WebSocket)

### 구조
```
브라우저 ←→ SockJS(/ws-chat) ←→ STOMP 프로토콜 ←→ SimpleBroker
```

### 인증 흐름 (쿠키 기반 — HttpOnly 대응)
```
1. SockJS 연결 요청 → HTTP 핸드셰이크 (쿠키 자동 전송)
   → HttpHandshakeInterceptor: 쿠키에서 access_token 추출 → 검증 → 세션 속성에 username 저장

2. STOMP CONNECT 프레임 → JwtChannelInterceptor
   → ① Authorization 헤더 확인 (앱용)
   → ② 없으면 세션 속성의 username 확인 (브라우저 쿠키용)
   → 인증 성공 → user, roomId 세션에 저장
```

### 메시지 흐름
```
클라이언트 send → /pub/room/{roomId} → ChatController.sendMessage() → /sub/room/{roomId} → 구독자 전원
```

### 이벤트
- 입장 (SessionConnectEvent): "OOO님이 입장했습니다."
- 퇴장 (SessionDisconnectEvent): "OOO님이 퇴장했습니다." (브라우저 종료/뒤로가기 감지)

---

## 📁 파일 업로드

### 설계 원칙
- 파일 업로드는 **별도 API**로 분리 (게시판 API + 파일 API)
- 파일 공통 관리 → `RefType` Enum으로 용도 구분
- 트랜잭션 불일치(파일만 업로드됨) → 배치로 해결

### 환경별 저장 전략 (Strategy Pattern)
| 환경 | 저장소 | 설정 |
|------|--------|------|
| 개발 | 로컬 파일시스템 (`./uploads/`) | `supabase.enabled: false` |
| 운영 | Supabase Storage (클라우드) | `supabase.enabled: true` |

yml 설정에 따라 `LocalFileStorage` 또는 `SupabaseFileStorage` 빈이 주입됨

---

## 🗄️ JPA 설계

### 연관관계 원칙
- **양방향 지양** → 프론트에서 API 분리 요청 (글 API + 댓글 API + 파일 API)
- 연관 데이터 조회:
  - 방법 1: 메인 쿼리 실행 후 ID 모아서 `IN` 쿼리로 한번에 처리
  - 방법 2: 조인 (JPQL, @EntityGraph 등)
  - 둘 다 Repository(QueryDSL)에서 처리. 연관관계가 너무 많을 때만 Service에서 처리 고려

### Repository 규칙
- 연관관계 필요 → `findByEntity()`
- 단순 조회 → `findByEntityId()` (ID만으로 조회)

### Paging
- `Pageable` → Controller 파라미터에서 직접 바인딩 (시작 0/1은 클라이언트가 처리)

---

## 🌐 프론트엔드 (CSR 패턴)

### 페이지 서빙 방식
```
HomeController (@Controller)
  → @GetMapping("/community") → return "community/list"  (빈 HTML)
  → 브라우저에서 JS 실행 → fetch('/api/communities') → JSON → DOM 렌더링
```

### 공통 JS 유틸 (layout/header.html에 정의)

| 함수 | 역할 |
|------|------|
| `authFetch(url, options)` | fetch 래퍼. 401 시 자동 토큰 재발급 + 재시도 |
| `callApi(url, options)` | authFetch + JSON 파싱 + 에러 처리 포함 |
| `handleApiError(response)` | API 에러 응답 파싱 |
| `showApiError(error)` | 에러 메시지 alert 표시 |
| `tryRefreshToken()` | 토큰 재발급 (`POST /api/tokens/refresh`) |
| `updateHeaderLoginStatus(isLoggedIn, nickname)` | 헤더 로그인/비로그인 UI 전환 |
| `checkHeaderLoginStatus()` | 페이지 로드 시 로그인 상태 확인 |
| `handleLogout()` | 로그아웃 처리 |

### 인증이 필요한 API 호출 패턴
```javascript
// authFetch: credentials: 'include'로 쿠키 자동 전송
const response = await authFetch('/api/communities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ title: '...', content: '...' })
});
```

### 레이아웃 구조
```html
<th:block th:replace="~{layout/header :: headerStyle}"></th:block>   <!-- CSS -->
<th:block th:replace="~{layout/footer :: footerStyle}"></th:block>   <!-- Footer CSS -->

<th:block th:replace="~{layout/header :: header}"></th:block>        <!-- 헤더 HTML -->
<!-- 페이지 본문 -->
<th:block th:replace="~{layout/footer :: footer}"></th:block>        <!-- 푸터 HTML -->

<script th:replace="~{layout/header :: headerScript}"></script>       <!-- 공통 JS -->
<script> /* 페이지별 JS */ </script>
```

---

## 🔧 환경 분리

| 환경 | 파일 | 특징 |
|------|------|------|
| 개발 | `application.yml` | ddl-auto: create, SQL 초기화, H2/MariaDB |
| 운영 | `application-prod.yml` | ddl-auto: update, SQL 초기화 비활성화 |

### 환경 변수 (.env)
```
KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
JWT_SECRET_KEY
SUPABASE_URL, SUPABASE_ANON_KEY (운영 시)
```

---

## 📝 로그
- **logback-spring.xml** 사용
- 콘솔 + 파일(일별 롤링) + 에러 분리
- 30일 보관, 용량 제한

---

## ✅ 구현 현황

| 기능 | 상태 | 패키지/파일 |
|------|------|-------------|
| Layer Architecture | ✅ | Controller/Service/Repository 분리 |
| API 표준 응답 | ✅ | `ApiResponse`, `PageResponse`, `ErrorResponse` |
| 전역 예외 처리 | ✅ | `GlobalExceptionHandler` |
| JWT 인증 | ✅ | `jwt/` 패키지 |
| OAuth2 로그인 | ✅ | 카카오, 구글 (보안 개선 적용) |
| 파일 업로드 | ✅ | `file/` 패키지, Strategy Pattern |
| 게시판 (CRUD) | ✅ | `community/` 패키지 |
| 댓글 (CRUD) | ✅ | `community/comment/` 패키지 |
| 실시간 채팅 | ✅ | `stomp/` 패키지 (STOMP + SockJS + JWT 인증) |
| 로그 설정 | ✅ | `logback-spring.xml` |
| 환경 분리 | ✅ | `application.yml` / `application-prod.yml` |
| Docker | ✅ | `Dockerfile` |
| Swagger | ✅ | `/swagger-ui.html` |
| Actuator | ✅ | `/actuator/health` |
| CORS | ✅ | `CorsConfig.java` |
| QueryDSL | ✅ | 게시판 검색/페이징 |

---

## 🚀 추가 고려사항 (선택)

| 기능 | 설명 | 언제 필요? |
|------|------|-----------|
| **Redis** | 세션/캐시/토큰 블랙리스트, WebSocket 세션 공유 | 서버 다중화 시 |
| **채팅 메시지 DB 저장** | 현재 메시지는 실시간 전송만 (저장 안 됨) | 채팅 이력 필요 시 |
| **이메일 발송** | 비밀번호 찾기, 알림 | 사용자 알림 필요 시 |
| **스케줄러** | @Scheduled 배치 작업 | 고아 파일 정리, 통계 집계 |
| **캐싱** | @Cacheable | 자주 조회되는 데이터 |
| **Rate Limiting** | API 호출 제한 | 악용 방지 |
| **Access Token 블랙리스트** | JWT 즉시 무효화 (Redis) | 강제 로그아웃 필요 시 |

### 프론트엔드 분리 시 (React/Vue/Flutter 등)
- `templates/` 폴더, `HomeController.java` 삭제
- CORS 설정 확인 (`CorsConfig.java`에 프론트 도메인 추가)
- 앱은 `Authorization: Bearer {token}` 헤더 방식 사용
- WebSocket: STOMP CONNECT 시 `Authorization` 헤더로 JWT 전달

