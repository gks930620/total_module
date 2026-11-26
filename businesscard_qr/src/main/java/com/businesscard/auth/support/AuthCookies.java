package com.businesscard.auth.support;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.common.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/**
 * 웹(PWA) 세션 쿠키. 설계: {@code 설계/웹앱_전환_설계.md} §3.
 *
 * <p><b>왜 쿠키인가:</b> 코드컨벤션 §7 — 토큰을 localStorage 에 두지 않는다.
 * localStorage 는 XSS 한 번에 장기 자격증명이 그대로 유출된다.
 * {@code HttpOnly} 쿠키는 스크립트가 아예 읽을 수 없다.
 *
 * <p><b>CSRF 는 {@code SameSite=Strict} 로 막는다.</b> 웹 프론트가 API 와 같은 오리진에서
 * 서빙되므로 Strict 로 조여도 정상 동작하고, 남의 사이트에서 날린 요청에는 쿠키가 붙지 않는다.
 * 그래서 별도 CSRF 토큰 체계를 두지 않는다.
 *
 * <p>{@code jakarta.servlet.http.Cookie} 대신 {@link ResponseCookie} 를 쓰는 이유는
 * 전자가 SameSite 속성을 다루지 못하기 때문이다.
 */
@Component
@RequiredArgsConstructor
public class AuthCookies {

    public static final String ACCESS = "bq_access";
    public static final String REFRESH = "bq_refresh";

    /** 카카오 로그인 왕복 동안만 사는 CSRF 방지값. */
    public static final String OAUTH_STATE = "bq_oauth_state";

    /** state 쿠키는 카카오 콜백 경로에만 실린다. */
    private static final String OAUTH_STATE_PATH = "/api/auth/kakao";

    /**
     * 로그인 한 번(동의 화면에서 머무는 시간)이면 충분하다.
     * 길게 두면 쓰지 않은 state 가 남아 재사용될 여지가 생긴다.
     */
    private static final long OAUTH_STATE_TTL_SECONDS = 600;

    /**
     * refresh 쿠키는 이 경로에서만 전송된다.
     *
     * <p>일반 API 요청마다 수명 14일짜리 토큰이 따라다니지 않게 범위를 좁힌다 —
     * 노출 지점이 줄면 유출 가능성도 줄어든다.
     */
    private static final String REFRESH_PATH = "/api/auth";

    private final JwtTokenProvider jwtTokenProvider;

    /**
     * 운영(HTTPS)에서만 Secure 를 켠다.
     *
     * <p>항상 켜면 로컬 http 개발에서 쿠키가 아예 저장되지 않아 로그인이 안 된다.
     * 환경 차이는 코드 분기가 아니라 설정으로 흡수한다(코드컨벤션 §5-1).
     */
    @Value("${app.cookie.secure:false}")
    private boolean secure;

    /** 발급된 토큰을 쿠키로 심는다. 본문 응답은 그대로 두므로 앱(헤더 방식)도 계속 동작한다. */
    public <T> ResponseEntity<T> attach(ResponseEntity.BodyBuilder builder, AuthTokenResponse tokens, T body) {
        return builder
                .header(HttpHeaders.SET_COOKIE, accessCookie(tokens.getAccessToken()).toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.getRefreshToken()).toString())
                .body(body);
    }

    /** 두 쿠키를 즉시 만료시킨다(Max-Age=0). 로그아웃·탈퇴에서 쓴다. */
    public <T> ResponseEntity<T> clear(ResponseEntity.BodyBuilder builder, T body) {
        return builder
                .header(HttpHeaders.SET_COOKIE, expired(ACCESS, "/").toString())
                .header(HttpHeaders.SET_COOKIE, expired(REFRESH, REFRESH_PATH).toString())
                .body(body);
    }

    /**
     * 카카오 로그인 state 쿠키.
     *
     * <p>⚠️ <b>여기만 {@code SameSite=Lax} 다. Strict 로 바꾸면 웹 로그인이 100% 깨진다.</b>
     * 카카오 → 우리 콜백은 <b>교차 사이트 최상위 이동</b>이라, Strict 쿠키는 브라우저가 싣지 않는다.
     * 그러면 콜백에서 state 를 대조할 값이 없어 모든 로그인이 거절된다.
     * Lax 는 최상위 GET 이동에는 쿠키를 실어 주므로 이 경로에 정확히 맞는다.
     *
     * <p>Lax 로 열어도 안전한 이유 — 이 쿠키는 <b>자격증명이 아니다.</b> 한 번 쓰고 버리는 난수일 뿐이라
     * 탈취돼도 로그인할 수 없다. 세션 쿠키({@link #ACCESS}/{@link #REFRESH})는 그대로 Strict 다.
     */
    public ResponseCookie oauthState(String state) {
        return ResponseCookie.from(OAUTH_STATE, state)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(OAUTH_STATE_PATH)
                .maxAge(OAUTH_STATE_TTL_SECONDS)
                .build();
    }

    /** 쓰고 난 state 는 즉시 버린다 — 성공이든 실패든. */
    public ResponseCookie clearedOauthState() {
        return ResponseCookie.from(OAUTH_STATE, "")
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(OAUTH_STATE_PATH)
                .maxAge(0)
                .build();
    }

    public Optional<String> readOauthState(HttpServletRequest request) {
        return read(request, OAUTH_STATE);
    }

    public Optional<String> readAccess(HttpServletRequest request) {
        return read(request, ACCESS);
    }

    public Optional<String> readRefresh(HttpServletRequest request) {
        return read(request, REFRESH);
    }

    private ResponseCookie accessCookie(String token) {
        return base(ACCESS, token, "/")
                .maxAge(jwtTokenProvider.getAccessTokenValiditySeconds())
                .build();
    }

    private ResponseCookie refreshCookie(String token) {
        return base(REFRESH, token, REFRESH_PATH)
                .maxAge(jwtTokenProvider.getRefreshTokenValiditySeconds())
                .build();
    }

    private ResponseCookie expired(String name, String path) {
        return base(name, "", path).maxAge(0).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String name, String value, String path) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)   // 스크립트가 읽을 수 없다
                .secure(secure)
                .sameSite("Strict") // CSRF 방어 본체
                .path(path);
    }

    private Optional<String> read(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> name.equals(cookie.getName()))
                .map(jakarta.servlet.http.Cookie::getValue)
                .filter(value -> value != null && !value.isBlank())
                .findFirst();
    }
}
