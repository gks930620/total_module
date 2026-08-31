# 05. 웹 보안과 HTTP — 상태코드 · CORS · 쿠키 · CSP · 토큰

> `/curl` 을 만들고, 이 프로젝트의 `SecurityConfig` 에 CSP 를 걸면서 정리한 것.
> [06_암호와_JWT.md](06_암호와_JWT.md) 이 "JWT 를 어떻게 만드나"라면, 여기는 **"그 토큰을 어디에 두고 어떻게 지키나"** 다.
> 기준: Spring Boot 3.x / Spring Security 6

---

## 0. 한 장 요약

| | |
|---|---|
| **401 vs 403** | 401 = 네가 **누군지 모르겠다**(인증). 403 = 누군진 알겠는데 **권한이 없다**(인가) |
| **CORS 는 방어가 아니다** | 브라우저가 **응답을 안 보여주는 것**뿐. 요청은 이미 서버에 도달했다 |
| **XSS 를 막으면 대부분이 해결된다** | XSS 앞에서는 어떤 토큰 저장 방식도 무의미하다 |
| **CSP 는 XSS 의 마지막 방어선** | 스크립트 출처를 브라우저가 강제한다 |
| **쿠키 3종 세트** | `HttpOnly` + `Secure` + `SameSite` |

---

## 1. 상태코드 — 자주 헷갈리는 것들

### 1.1 인증과 인가

| 코드 | 언제 | 실무 |
|---|---|---|
| **401** Unauthorized | 인증 정보가 **없거나 틀렸다** | 이름이 잘못 지어졌다. 사실은 "Unauthenticated" 다 |
| **403** Forbidden | 인증은 됐는데 **권한이 없다** | 관리자 페이지에 일반 사용자가 접근 |

**401 은 `WWW-Authenticate` 헤더를 함께 보내야 한다**(RFC 9110). 실제로는 잘 안 지켜진다.

> 보안상 **404 를 쓰는 게 나을 때가 있다.** 403 은 "그 리소스가 존재한다"는 정보를 준다.
> 남의 문서 ID 를 넣었을 때 403 이 오면 그 ID 가 유효하다는 걸 알려주는 셈이다.

### 1.2 리다이렉트

| 코드 | 영구성 | 메서드 유지 |
|---|---|---|
| 301 Moved Permanently | 영구 | ❌ POST → GET 으로 바뀔 수 있다 |
| 302 Found | 임시 | ❌ 마찬가지 |
| **307** Temporary Redirect | 임시 | ✅ **메서드와 본문을 유지** |
| **308** Permanent Redirect | 영구 | ✅ 유지 |

**301 은 브라우저가 캐시한다 — 한번 잘못 내보내면 되돌리기 매우 어렵다.**
확신이 없으면 302 로 시작한다. HTTP→HTTPS 강제도 처음엔 302 로 검증하고 301 로 굳힌다.

### 1.3 4xx 에서 자주 쓰는 것

| 코드 | 언제 |
|---|---|
| 400 Bad Request | 문법이 잘못됨(JSON 파싱 실패 등) |
| **409** Conflict | 현재 상태와 충돌 — 중복 가입, 낙관적 락 실패 |
| **422** Unprocessable Content | 문법은 맞는데 **의미가 틀림** — 유효성 검증 실패 |
| **429** Too Many Requests | 레이트 리밋. `Retry-After` 헤더를 같이 |

400 과 422 의 구분은 **팀에서 정하면 된다**. 다만 정해서 일관되게 쓴다.
Spring 의 `@Valid` 실패는 기본이 400 이다.

### 1.4 5xx

| 코드 | 언제 |
|---|---|
| 500 | 서버 내부 오류. **여기에 스택트레이스를 담아 보내면 안 된다** |
| 502 Bad Gateway | 프록시가 상위 서버에서 이상한 응답을 받음 |
| 503 Service Unavailable | 일시적 과부하·점검. `Retry-After` 로 언제 다시 올지 알린다 |
| 504 Gateway Timeout | 상위 서버 응답이 늦음 |

배포 중 502/504 가 뜨면 대개 **헬스체크와 실제 준비 상태가 어긋난** 것이다.
이 프로젝트가 `/healthz` 를 둔 이유이기도 하다.

---

## 2. CORS — 가장 많이 오해받는 것

### 2.1 무엇이 아닌가

**CORS 는 보안 장치가 아니다.** 브라우저가 **응답을 JS 에 넘겨주지 않는 규칙**일 뿐이다.

```
브라우저 → (요청 전송) → 서버   ← 이미 도착했다. 서버는 처리했다
브라우저 ← (응답 수신) ← 서버
브라우저: "Access-Control-Allow-Origin 이 없네" → JS 에 안 넘김
```

**요청은 이미 서버에 도달했고 부수효과도 일어났다.** curl·Postman·서버 간 통신에는
CORS 가 아예 존재하지 않는다. 그러니 CORS 로 API 를 보호할 수 없다 — 그건 인증의 일이다.

### 2.2 단순 요청과 사전 요청(preflight)

**단순 요청** — 아래를 전부 만족하면 바로 보낸다.
- 메서드가 `GET` `HEAD` `POST`
- `Content-Type` 이 `text/plain`, `multipart/form-data`, `application/x-www-form-urlencoded`
- 커스텀 헤더가 없음

**그 외에는 `OPTIONS` 로 먼저 물어본다.**

```http
OPTIONS /api/orders HTTP/1.1
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: authorization, content-type

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 3600          ← 이 시간 동안 preflight 생략
```

> `Content-Type: application/json` 은 **단순 요청이 아니다.** 그래서 요즘 API 는
> 거의 모든 요청에 preflight 가 붙는다. `Access-Control-Max-Age` 를 안 주면
> 매 요청마다 왕복이 두 번이 되어 눈에 띄게 느려진다.

### 2.3 쿠키를 같이 보낼 때

```js
fetch(url, { credentials: "include" })
```

```http
Access-Control-Allow-Origin: https://app.example.com   ← * 는 불가!
Access-Control-Allow-Credentials: true
```

**`credentials` 를 쓰면 `Allow-Origin: *` 이 금지된다.** 정확한 출처를 적어야 한다.
그래서 허용 출처 목록을 두고 요청의 `Origin` 을 검사해 그대로 반사하는 식으로 구현한다
(반사할 때 **화이트리스트 검증을 반드시 한다** — 안 하면 아무 출처나 허용하는 것과 같다).

```java
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration c = new CorsConfiguration();
    c.setAllowedOrigins(List.of("https://app.example.com"));  // setAllowedOriginPatterns("*") 는 위험
    c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    c.setAllowCredentials(true);
    c.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
    s.registerCorsConfiguration("/api/**", c);
    return s;
}
```

---

## 3. 쿠키

```http
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

| 속성 | 하는 일 |
|---|---|
| **`HttpOnly`** | **JS 에서 못 읽는다**(`document.cookie` 에 안 보임). XSS 로 탈취되는 걸 막는 핵심 |
| **`Secure`** | HTTPS 에서만 전송 |
| **`SameSite`** | 다른 사이트에서 온 요청에 쿠키를 붙일지 |
| `Path` / `Domain` | 범위 |
| `Max-Age` / `Expires` | 수명. 없으면 브라우저 닫을 때까지(세션 쿠키) |

### SameSite

| 값 | 동작 |
|---|---|
| `Strict` | 다른 사이트에서 온 요청에는 **절대** 안 붙는다. 외부 링크로 들어오면 로그아웃 상태로 보인다 |
| **`Lax`** | 최상위 **GET 이동**에만 붙는다. **현대 브라우저 기본값** |
| `None` | 항상 붙는다. **`Secure` 필수** |

`Lax` 가 기본이 되면서 **CSRF 가 상당 부분 자동으로 막혔다**.
POST 요청에는 크로스 사이트 쿠키가 안 붙기 때문이다.
다만 이걸 유일한 방어로 삼진 않는다 — 구형 브라우저와 GET 으로 상태를 바꾸는 API 가 남아 있다.

---

## 4. XSS · CSRF · 클릭재킹

### 4.1 XSS — 남의 스크립트가 내 페이지에서 도는 것

| 종류 | 어떻게 |
|---|---|
| Stored | 게시글에 `<script>` 를 저장 → 보는 사람마다 실행 |
| Reflected | URL 파라미터가 그대로 화면에 출력 |
| DOM-based | 서버를 안 거치고 JS 가 `innerHTML` 등으로 직접 주입 |

**막는 법은 결국 하나다 — 출력할 때 문맥에 맞게 이스케이프한다.**

```js
element.textContent = userInput;   // ✅ 안전. 항상 이걸 먼저 고려한다
element.innerHTML   = userInput;   // ❌ 위험
```

React·Vue 는 기본적으로 이스케이프하지만 **탈출구가 있다.**

```jsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />   // ❌ 이름값 한다
<a href={userInput}>링크</a>    // ⚠️ javascript: 스킴이 들어갈 수 있다
```

HTML 을 꼭 넣어야 하면 **DOMPurify** 같은 검증된 새니타이저를 쓴다. 직접 만들지 않는다.

> **입력 시점에 필터링하지 않고 출력 시점에 이스케이프한다.**
> 같은 값이 HTML·JS·URL·CSS 안에서 각각 다르게 위험하므로,
> 어디에 쓰일지 아는 출력 시점에 처리하는 게 맞다.

### 4.2 CSRF — 내 세션으로 남이 요청을 시키는 것

로그인된 사용자가 공격자 페이지를 열면, 그 페이지가 우리 서버로 요청을 보낸다.
브라우저가 **쿠키를 자동으로 붙이니** 서버는 정상 요청으로 본다.

| 방어 | 설명 |
|---|---|
| `SameSite=Lax` | 대부분 자동으로 막힌다 (기본값) |
| CSRF 토큰 | 폼/헤더에 예측 불가한 토큰. 세션 기반 앱의 정석 |
| `Authorization` 헤더 | **헤더는 자동으로 안 붙는다** → 토큰을 헤더로 보내면 CSRF 가 원천적으로 안 생긴다 |

Spring Security 는 CSRF 방어가 **기본 켜짐**이다. REST API 에서 끄는 경우가 많은데,
**쿠키로 인증한다면 끄면 안 된다.** 헤더 기반 토큰일 때만 꺼도 된다.

```java
// 쿠키 세션 → 켜 둔다
http.csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()));
// 무상태 + Authorization 헤더 → 꺼도 된다
http.csrf(AbstractHttpConfigurer::disable)
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
```

### 4.3 클릭재킹

내 사이트를 투명한 `<iframe>` 으로 덮어 사용자가 모르고 누르게 하는 것.

```http
Content-Security-Policy: frame-ancestors 'none'    ← 현대적 방법
X-Frame-Options: DENY                              ← 구형 브라우저용
```

---

## 5. 보안 헤더 — 이 프로젝트가 실제로 거는 것

`SecurityConfig` 에 있는 그대로다.

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  font-src 'self'; img-src 'self' data: blob: https:; connect-src 'none';
  worker-src 'self' blob:; object-src 'none'; frame-ancestors 'self';
  base-uri 'self'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()
X-Frame-Options: SAMEORIGIN
```

| 헤더 | 무엇을 막나 |
|---|---|
| **CSP** | XSS 의 최후 방어선. 스크립트가 어디서 올 수 있는지 브라우저가 강제 |
| `nosniff` | 브라우저가 Content-Type 을 무시하고 추측하는 것. 업로드된 텍스트가 스크립트로 실행되는 걸 막는다 |
| `Referrer-Policy` | 외부로 나갈 때 URL(쿼리스트링 포함)이 새는 것 |
| **HSTS** | HTTP 로 접속 시도 자체를 브라우저가 차단. `max-age` 동안 기억한다 |
| `Permissions-Policy` | 카메라·마이크·위치 등 기능 접근 |

### CSP 를 읽는 법

- `default-src 'self'` — 기본은 **같은 출처만**
- `connect-src 'none'` — **`fetch`/XHR/WebSocket 을 아예 금지**.
  이 프로젝트의 "서버로 아무것도 안 보낸다"는 약속을 **문장이 아니라 브라우저가 강제**하게 만든 것이다.
  이걸 걸 수 있었던 건 Google Fonts 를 self-host 해서 마지막 외부 요청을 없앴기 때문이다
- `'unsafe-inline'` — 인라인 `<style>`/`onclick` 허용. **`script-src` 에 있으면 CSP 의 의미가 거의 사라진다.**
  여기선 style 에만 열어 뒀다
- `object-src 'none'`, `base-uri 'self'` — 잊기 쉬운데 우회 경로를 막는 데 중요하다

> **HSTS 는 되돌리기 어렵다.** `max-age` 동안 브라우저가 기억하므로,
> 인증서에 문제가 생기면 사용자가 접속할 방법이 없다. 짧은 `max-age` 로 시작한다.

---

## 6. 토큰을 어디에 둘 것인가

JWT 를 만들었다면 다음 질문은 항상 이것이다.

| 저장소 | XSS 에 | CSRF 에 | 비고 |
|---|---|---|---|
| `localStorage` | ❌ **JS 가 읽으니 그대로 털린다** | ✅ 안전(자동 전송 안 됨) | 가장 흔하지만 가장 위험 |
| `HttpOnly` 쿠키 | ✅ JS 가 못 읽는다 | ⚠️ `SameSite`/CSRF 토큰 필요 | 권장 |
| 메모리(JS 변수) | ⚠️ 실행 중인 XSS 는 접근 가능하나 지속성 없음 | ✅ | 새로고침 시 사라짐 |

**현재 널리 쓰이는 구성**

```
Access Token   — 짧게(15분), 메모리에 보관, Authorization 헤더로 전송
Refresh Token  — 길게(2주), HttpOnly + Secure + SameSite 쿠키
```

Access 는 짧아서 털려도 피해가 제한되고, Refresh 는 JS 가 아예 못 읽는다.

> **다만 XSS 가 뚫린 시점에 이 모든 논의는 의미가 약해진다.**
> 공격자 스크립트가 페이지에서 도는 이상 `HttpOnly` 쿠키를 못 읽어도
> **그 쿠키를 쓰는 요청을 대신 보낼 수 있다.** 저장 위치는 피해를 줄일 뿐,
> 진짜 방어는 **XSS 를 막는 것**이다.

### 토큰을 무효화하는 문제

JWT 는 **서버가 상태를 안 갖는 게 장점**인데, 그래서 **로그아웃·강제 만료가 어렵다.**
서명이 유효하면 서버는 받아들인다.

| 방법 | 대가 |
|---|---|
| 만료를 짧게 | 재발급이 잦아진다 |
| 블랙리스트(Redis) | 무상태를 포기 — 매 요청 조회 |
| 토큰 버전을 DB 에 | 마찬가지로 조회 필요 |

"완전 무상태 + 즉시 무효화"는 **동시에 못 가진다.** 어느 쪽을 포기할지 정해야 한다.

---

## 7. 이 프로젝트와 이어지는 곳

| 여기서 배운 것 | 도구/코드 |
|---|---|
| 요청을 curl/코드로 옮기기 | `/curl` — 헤더·쿠키가 실제로 어떻게 실리는지 보인다 |
| CSP·HSTS·nosniff 실제 설정 | `common/config/SecurityConfig.java` |
| `connect-src 'none'` 으로 약속을 강제 | 같은 파일. [설계/02](../설계/01_제품.md) NFR-02 |
| JWT 를 만드는 쪽 | `/jwt` · [06_암호와_JWT.md](06_암호와_JWT.md) |

---

## 8. 더 읽을 것

- [MDN HTTP](https://developer.mozilla.org/ko/docs/Web/HTTP) — 상태코드·헤더의 1차 참고
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) — XSS·CSRF·세션 관리 실무 지침
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CSP 평가기 (Google)](https://csp-evaluator.withgoogle.com/) — 내 CSP 가 실제로 막고 있는지 확인
- [securityheaders.com](https://securityheaders.com/) — 배포 후 헤더 점검
- [Spring Security Reference](https://docs.spring.io/spring-security/reference/)
