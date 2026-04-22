package com.test.test.stomp.config;

import com.test.test.jwt.JwtUtil;
import com.test.test.stomp.interceptor.HttpHandshakeInterceptor;
import com.test.test.stomp.interceptor.JwtChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;
    private final JwtChannelInterceptor jwtChannelInterceptor;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-chat")
            .setAllowedOriginPatterns("*")
            .addInterceptors(new HttpHandshakeInterceptor(jwtUtil))  // 쿠키에서 JWT 추출
            .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/pub");  // 클라이언트 → 서버
        registry.enableSimpleBroker("/sub");                  // 서버 → 클라이언트 (구독)
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(jwtChannelInterceptor);
    }
}

