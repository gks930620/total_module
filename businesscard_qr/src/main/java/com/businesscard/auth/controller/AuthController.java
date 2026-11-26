package com.businesscard.auth.controller;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.dto.KakaoLoginRequest;
import com.businesscard.auth.dto.RefreshTokenRequest;
import com.businesscard.auth.service.AuthService;
import com.businesscard.auth.support.AuthCookies;
import com.businesscard.common.dto.ApiResponse;
import com.businesscard.common.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증. 두 채널을 함께 지원한다 — 설계 {@code 설계/웹앱_전환_설계.md} §3.
 *
 * <ul>
 *   <li><b>웹(PWA)</b>: HttpOnly 쿠키. 브라우저가 알아서 싣고, 스크립트는 읽을 수 없다.</li>
 *   <li><b>앱</b>: 응답 <b>본문</b>의 토큰을 직접 들고 Authorization 헤더로 보낸다.</li>
 * </ul>
 *
 * 같은 응답이 양쪽을 모두 만족시키므로(본문 + Set-Cookie) 채널별 엔드포인트를 따로 두지 않는다.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthCookies authCookies;

    @PostMapping("/kakao")
    public ResponseEntity<ApiResponse<AuthTokenResponse>> loginWithKakao(
            @Valid @RequestBody KakaoLoginRequest request
    ) {
        AuthTokenResponse tokens = authService.loginWithKakaoAccessToken(request.getKakaoAccessToken());
        return authCookies.attach(ResponseEntity.ok(), tokens, ApiResponse.success("Login success", tokens));
    }

    /**
     * 토큰 갱신. 리프레시 토큰을 <b>쿠키 또는 본문</b>에서 찾는다.
     *
     * <p>웹은 본문을 보내지 않는다(쿠키를 읽을 수 없으니 담을 수도 없다).
     * 그래서 {@code required = false} 로 두고 쿠키를 먼저 본다.
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthTokenResponse>> refresh(
            HttpServletRequest httpRequest,
            @RequestBody(required = false) RefreshTokenRequest request
    ) {
        String refreshToken = authCookies.readRefresh(httpRequest)
                .orElseGet(() -> request == null ? null : request.getRefreshToken());
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new UnauthorizedException("Refresh token is required.");
        }

        AuthTokenResponse tokens = authService.refresh(refreshToken);
        return authCookies.attach(ResponseEntity.ok(), tokens, ApiResponse.success("Token refreshed", tokens));
    }

    /**
     * 로그아웃 — 쿠키를 즉시 만료시킨다.
     *
     * <p>인증을 요구하지 않는다. 이미 토큰이 만료돼 401 이 나는 상태에서도
     * <b>남은 쿠키는 지울 수 있어야</b> 하기 때문이다.
     *
     * <p>서버에 세션이 없는 무상태 JWT 라서, 이미 발급된 토큰 자체를 무효화하지는 못한다.
     * 액세스 토큰 수명이 1시간으로 짧은 것이 그 보완이다.
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout() {
        return authCookies.clear(ResponseEntity.ok(), ApiResponse.success("Logged out", null));
    }
}
