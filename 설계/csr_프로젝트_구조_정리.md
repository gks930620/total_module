# Backend REST API Project Structure

> Spring Boot + JWT + OAuth2 + STOMP WebSocket backend server documentation

---

## Architecture

### Layered Structure
```
Controller -> Service -> Repository
```

| Layer | Responsibility | Rule |
|------|------|------|
| Controller | Request/response handling | Do not access Repository directly |
| Service | Business logic | Transaction, validation, domain flow |
| Repository | Data access | JPA/QueryDSL query responsibilities |

### API Design Rules
- One endpoint maps to one controller entry and one service entry.
- Use shared response formats: `ApiResponse`, `ErrorResponse`, `PageResponse`.
- Prefer QueryDSL DTO projections for read-only query paths.

---

## Package Layout

```
com.test.test/
+-- DemoApplication.java
+-- common/
|   +-- config/
|   |   +-- CorsConfig.java
|   |   +-- QuerydslConfig.java
|   |   +-- WebConfig.java
|   +-- dto/
|   |   +-- ApiResponse.java
|   |   +-- ErrorResponse.java
|   |   +-- PageResponse.java
|   +-- exception/
|       +-- GlobalExceptionHandler.java
+-- jwt/
|   +-- config/SecurityConfig.java
|   +-- filter/
|   +-- handler/
|   +-- controller/
|   +-- service/
|   +-- model/
|   +-- entity/
|   +-- repository/
+-- community/
+-- file/
+-- stomp/
```

---

## Response and Error Policy

### Success Response
```java
ResponseEntity<ApiResponse<T>>
```

### Error Response
```json
{
  "success": false,
  "message": "...",
  "errorCode": "...",
  "timestamp": "..."
}
```

### Main HTTP Status Codes
- 400: validation or business rule violation
- 401: authentication failure, expired or invalid token
- 403: forbidden
- 404: resource not found
- 409: duplicate or conflict

---

## Security (JWT + OAuth2)

### JWT Policy
- Access token: 30 minutes
- Refresh token: 4 hours
- Refresh token is stored and rotated on refresh

### Authentication Flow
1. Login via `POST /api/login`
2. Issue JWT and set cookies
3. Validate access token in request filter
4. Reissue via `POST /api/tokens/refresh` when needed

### OAuth2
- Kakao and Google OAuth2 supported
- App token integration API: `POST /api/oauth2/providers/{provider}/tokens`

---

## WebSocket (STOMP)

- Endpoint: `/ws-chat`
- Publish prefix: `/pub`
- Subscribe broker: `/sub`
- JWT-based authentication on CONNECT

---

## File Upload

- File API is separated from domain APIs.
- Storage is abstracted through `FileStorageStrategy`.
  - Local mode: `supabase.enabled=false`
  - Supabase mode: `supabase.enabled=true`

---

## Environment Split

| Environment | File | Notes |
|------|------|------|
| Local | `application.yml` | Local development defaults |
| Production | `application-prod.yml` | Production DB and security settings |

### Main Environment Variables
- `JWT_SECRET_KEY`
- `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `APP_CORS_ALLOWED_ORIGINS`

---

## Implemented Scope

- Auth: JWT, OAuth2
- Community and comment: CRUD APIs
- File: upload and read APIs
- Realtime chat: STOMP
- Ops: Swagger, Actuator, logging
