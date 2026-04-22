package com.test.test.stomp.interceptor;

import com.test.test.jwt.JwtUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * WebSocket HTTP 핸드셰이크 시 쿠키에서 JWT를 추출하여 세션 속성에 저장
 * - 브라우저는 HttpOnly 쿠키를 JS로 읽을 수 없으므로,
 *   HTTP 핸드셰이크 단계에서 쿠키를 읽어 WebSocket 세션에 전달
 */
@Slf4j
@RequiredArgsConstructor
public class HttpHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            Cookie[] cookies = httpRequest.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("access_token".equals(cookie.getName())) {
                        String token = cookie.getValue();
                        String username = jwtUtil.validateAndExtractUsername(token);
                        if (username != null) {
                            attributes.put("cookieUsername", username);
                            log.debug("WebSocket 핸드셰이크 - 쿠키에서 사용자 인증: {}", username);
                        }
                        break;
                    }
                }
            }
        }
        return true; // 핸드셰이크 자체는 항상 허용 (인증은 STOMP CONNECT에서 최종 검증)
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // 후처리 불필요
    }
}

