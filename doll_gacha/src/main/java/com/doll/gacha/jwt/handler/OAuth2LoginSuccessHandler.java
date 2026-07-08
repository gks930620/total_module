package com.doll.gacha.jwt.handler;

import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.repository.InMemoryAuthorizationRequestRepository;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.service.RefreshService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * OAuth2 로그인 성공 시 처리하는 Handler
 * - config가 아닌 handler 패키지로 이동 (역할에 맞는 패키지 분리)
 */
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtUtil jwtUtil;
    private final RefreshService refreshService;
    private final InMemoryAuthorizationRequestRepository authorizationRequestRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.cookie.secure:false}")
    private boolean secureCookie;  // 로컬: false, 운영(HTTPS): true

    // 앱(target=app) OAuth2 완료 후 토큰을 전달할 리다이렉트 베이스 URL
    // - 기본값은 로컬 Android 에뮬레이터(10.0.2.2) 주소 (기존 하드코딩 값 유지)
    // - 운영에서 앱 웹뷰 플로우를 쓰려면 환경변수 APP_OAUTH2_REDIRECT_BASE 로 교체
    //   (현재 앱은 네이티브 SDK + /api/oauth2/{provider}/app 방식이라 이 경로는 거의 사용 안 함)
    @Value("${app.oauth2.app-redirect-base:http://10.0.2.2:8080}")
    private String appRedirectBase;

    // OAuth2 인증 필터(OAuth2LoginAuthenticationFilter)가 인증을 완료한 후 호출됨
    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
        Authentication authentication) throws IOException, ServletException {

        CustomUserAccount customUserAccount = (CustomUserAccount) authentication.getPrincipal();
        String username = customUserAccount.getUsername();

        // 1. 토큰 생성
        String accessToken = jwtUtil.createAccessToken(username);
        String refreshToken = jwtUtil.createRefreshToken(username);
        // 2. Refresh 토큰 저장 (DB)
        refreshService.saveRefresh(refreshToken);

        // 3. 시작 시 저장했던 target(web/app) 정보 가져오기
        var authRequest = authorizationRequestRepository.loadAuthorizationRequest(request);
        String target = (authRequest != null) ? (String) authRequest.getAttribute("target") : "web";

        // 4. 응답 분기 처리
        if ("app".equals(target)) {
            // ✅ 앱: 리다이렉트 방식
            String targetUrl = UriComponentsBuilder.fromUriString(appRedirectBase + "/login/success")
                .queryParam("access_token", accessToken)
                .queryParam("refresh_token", refreshToken)
                .build().toUriString();

            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } else {
            // ✅ 웹: 쿠키 설정 + 리다이렉트
            addCookie(response, "access_token", accessToken, -1);
            addCookie(response, "refresh_token", refreshToken, -1);

            getRedirectStrategy().sendRedirect(request, response, "/map");
        }

        // 5. 사용 완료된 요청 정보 명시적 삭제 (메모리 절약)
        String state = request.getParameter("state");
        if (state != null) {
            authorizationRequestRepository.deleteAuthorizationRequest(state);
        }
    }

    private void addCookie(HttpServletResponse response, String name, String value, int maxAge) {
        ResponseCookie.ResponseCookieBuilder cookieBuilder = ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(secureCookie)  // 로컬(HTTP): false, 운영(HTTPS): true
            .sameSite("Lax")
            .path("/");

        if (maxAge > 0) {
            cookieBuilder.maxAge(maxAge);
        }

        response.addHeader("Set-Cookie", cookieBuilder.build().toString());
    }
}

