package com.doll.gacha.jwt.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.common.dto.ErrorResponse;
import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.entity.RefreshEntity;
import com.doll.gacha.jwt.service.RefreshService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/refresh")
@RequiredArgsConstructor
public class RefreshController {

    private final JwtUtil jwtUtil;
    private final RefreshService refreshService;

    @org.springframework.beans.factory.annotation.Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/reissue")
    public ResponseEntity<?> refreshAccessToken(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        // 1. 토큰 추출 (헤더 우선, 없으면 쿠키에서)
        String token = extractRefreshToken(request, authHeader);

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("Refresh Token이 필요합니다", "TOKEN_REQUIRED"));
        }

        // 2. 폐기된 토큰(로그아웃)인지 검증 = DB에 있냐 없냐
        RefreshEntity find = refreshService.getRefresh(token);
        if (find == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("폐기된 토큰입니다. 다시 로그인해주세요.", "TOKEN_DISCARDED"));
        }

        // 3. 기존 refresh 토큰 삭제
        refreshService.deleteRefresh(token);

        // 4. Refresh Token 만료 검증
        if (!jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("Refresh Token이 만료되었습니다. 다시 로그인해주세요.", "TOKEN_EXPIRED"));
        }

        // 5. 새 토큰 발급
        String username = jwtUtil.extractUsername(token);
        String newAccessToken = jwtUtil.createAccessToken(username);
        String newRefreshToken = jwtUtil.createRefreshToken(username);

        refreshService.saveRefresh(newRefreshToken);

        // 6. 응답 분기 (웹/앱)
        // 쿠키로 refresh_token이 왔으면 웹, Authorization 헤더로 왔으면 앱
        boolean isWebRequest = (authHeader == null || !authHeader.startsWith("Bearer "));

        if (isWebRequest) {
            // 웹: 쿠키로 응답
            addCookie(response, "access_token", newAccessToken);
            addCookie(response, "refresh_token", newRefreshToken);
            return ResponseEntity.ok(ApiResponse.success("토큰 재발급 성공", null));
        } else {
            // 앱: JSON으로 응답
            Map<String, String> tokenData = Map.of(
                    "access_token", newAccessToken,
                    "refresh_token", newRefreshToken
            );
            return ResponseEntity.ok(ApiResponse.success("토큰 재발급 성공", tokenData));
        }
    }

    /**
     * Refresh Token 추출 (헤더 우선, 없으면 쿠키에서)
     */
    private String extractRefreshToken(HttpServletRequest request, String authHeader) {
        // 1. Authorization 헤더에서 추출 (앱용)
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.replace("Bearer ", "");
        }

        // 2. 쿠키에서 추출 (웹용)
        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                    .filter(cookie -> "refresh_token".equals(cookie.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }

        return null;
    }

    /**
     * HttpOnly 쿠키 추가
     */
    private void addCookie(HttpServletResponse response, String name, String value) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(cookieSecure) // 로컬 false / 운영(HTTPS) true — app.cookie.secure
                .sameSite("Lax")
                .path("/")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }
}
