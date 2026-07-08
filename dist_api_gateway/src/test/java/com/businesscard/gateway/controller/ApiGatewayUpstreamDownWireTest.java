package com.businesscard.gateway.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.ServerSocket;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 업스트림이 죽어 있을 때(연결 거부) 500이 아니라 502를 반환하는지 와이어 레벨로 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiGatewayUpstreamDownWireTest {

    @DynamicPropertySource
    static void deadUpstream(DynamicPropertyRegistry registry) throws IOException {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            closedPort = socket.getLocalPort();
        }
        int port = closedPort;
        registry.add("app.gateway.target-base-url", () -> "http://127.0.0.1:" + port);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void unreachableUpstreamReturns502WithJsonBody() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/business-cards", String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(502);
        assertThat(response.getHeaders().getContentType()).isNotNull();
        assertThat(response.getHeaders().getContentType().toString()).contains("application/json");
        assertThat(response.getBody()).contains("\"success\":false");
        assertThat(response.getBody()).contains("업스트림 서비스에 연결할 수 없습니다");
    }
}
