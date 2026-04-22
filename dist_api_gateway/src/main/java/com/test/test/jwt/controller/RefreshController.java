package com.test.test.jwt.controller;

import com.businesscard.common.dto.ApiResponse;
import com.businesscard.common.dto.ErrorResponse;
import com.test.test.jwt.JwtUtil;
import com.test.test.jwt.entity.RefreshEntity;
import com.test.test.jwt.service.RefreshService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tokens")
@RequiredArgsConstructor
public class RefreshController {

    private final JwtUtil jwtUtil;
    private final RefreshService refreshService;

    @Value("${app.cookie.secure:false}")
    private boolean secureCookie;

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String token = extractRefreshToken(request, authHeader);
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("Refresh token is required", "TOKEN_REQUIRED"));
        }

        RefreshEntity found = refreshService.getRefresh(token);
        if (found == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("Refresh token is invalid", "TOKEN_DISCARDED"));
        }

        if (!jwtUtil.validateToken(token)) {
            refreshService.deleteRefresh(token);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ErrorResponse.of("Refresh token is expired", "TOKEN_EXPIRED"));
        }

        refreshService.deleteRefresh(token);

        String username = jwtUtil.extractUsername(token);
        String newAccessToken = jwtUtil.createAccessToken(username);
        String newRefreshToken = jwtUtil.createRefreshToken(username);

        refreshService.saveRefresh(newRefreshToken);

        boolean isWebRequest = (authHeader == null || !authHeader.startsWith("Bearer "));

        if (isWebRequest) {
            addCookie(response, "access_token", newAccessToken);
            addCookie(response, "refresh_token", newRefreshToken);
            return ResponseEntity.ok(ApiResponse.success("Token refreshed", null));
        }

        Map<String, String> tokenData = Map.of(
                "access_token", newAccessToken,
                "refresh_token", newRefreshToken
        );
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", tokenData));
    }

    private String extractRefreshToken(HttpServletRequest request, String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.replace("Bearer ", "");
        }

        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                    .filter(cookie -> "refresh_token".equals(cookie.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }

        return null;
    }

    private void addCookie(HttpServletResponse response, String name, String value) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
    }
}
