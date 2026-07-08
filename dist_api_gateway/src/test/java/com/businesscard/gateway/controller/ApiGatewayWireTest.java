package com.businesscard.gateway.controller;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Random;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okio.Buffer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 실제 HTTP 클라이언트(Apache HttpClient 5)를 거치는 와이어 레벨 테스트.
 * MockWebServer를 업스트림으로 세워 스트리밍/멀티파트/리다이렉트/헤더 전달을 검증한다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiGatewayWireTest {

    private static MockWebServer upstream;

    @DynamicPropertySource
    static void registerUpstream(DynamicPropertyRegistry registry) throws IOException {
        upstream = new MockWebServer();
        upstream.start();
        registry.add("app.gateway.target-base-url", ApiGatewayWireTest::upstreamBaseUrl);
    }

    private static String upstreamBaseUrl() {
        String url = upstream.url("/").toString();
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    @AfterAll
    static void shutdownUpstream() throws IOException {
        upstream.shutdown();
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    private String gatewayUrl(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    void multipartBodyIsForwardedByteIdenticalWithOriginalBoundary() throws Exception {
        byte[] filePart = new byte[1024 * 1024];
        new Random(42).nextBytes(filePart);

        String boundary = "wire-test-boundary-1a2b3c";
        ByteArrayOutputStream bodyStream = new ByteArrayOutputStream();
        bodyStream.write(("--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\"blob.bin\"\r\n"
                + "Content-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        bodyStream.write(filePart);
        bodyStream.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
        byte[] rawBody = bodyStream.toByteArray();

        upstream.enqueue(new MockResponse().setResponseCode(201).setBody("uploaded"));

        HttpHeaders headers = new HttpHeaders();
        String contentType = "multipart/form-data; boundary=" + boundary;
        headers.set(HttpHeaders.CONTENT_TYPE, contentType);

        ResponseEntity<String> response = restTemplate.exchange(
                gatewayUrl("/api/files"), HttpMethod.POST, new HttpEntity<>(rawBody, headers), String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo("uploaded");

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getPath()).isEqualTo("/api/files");
        assertThat(recorded.getHeader("Content-Type")).isEqualTo(contentType);
        assertThat(recorded.getBody().readByteArray()).isEqualTo(rawBody);
    }

    @Test
    void upstreamErrorStatusAndBodyPassThroughUnchanged() throws Exception {
        String errorBody = "{\"success\":false,\"message\":\"명함을 찾을 수 없습니다\"}";
        upstream.enqueue(new MockResponse()
                .setResponseCode(404)
                .setHeader("Content-Type", "application/json")
                .setBody(errorBody));

        ResponseEntity<String> response =
                restTemplate.getForEntity(gatewayUrl("/api/business-cards/999"), String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).isEqualTo(errorBody);

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getPath()).isEqualTo("/api/business-cards/999");
    }

    @Test
    void absoluteRedirectLocationIsRewrittenToGatewayOrigin() throws Exception {
        upstream.enqueue(new MockResponse()
                .setResponseCode(302)
                .setHeader("Location", upstreamBaseUrl() + "/swagger-ui/index.html"));

        // TestRestTemplate은 GET 리다이렉트를 따라갈 수 있으므로, 명시적으로 끈 OkHttp로 확인한다.
        OkHttpClient client = new OkHttpClient.Builder().followRedirects(false).build();
        Request request = new Request.Builder().url(gatewayUrl("/swagger-ui.html")).build();
        try (Response response = client.newCall(request).execute()) {
            assertThat(response.code()).isEqualTo(302);
            assertThat(response.header("Location"))
                    .isEqualTo("http://localhost:" + port + "/swagger-ui/index.html");
        }

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getPath()).isEqualTo("/swagger-ui.html");
    }

    @Test
    void relativeRedirectLocationPassesThroughUnchanged() throws Exception {
        upstream.enqueue(new MockResponse()
                .setResponseCode(302)
                .setHeader("Location", "/swagger-ui/index.html"));

        OkHttpClient client = new OkHttpClient.Builder().followRedirects(false).build();
        Request request = new Request.Builder().url(gatewayUrl("/swagger-ui.html")).build();
        try (Response response = client.newCall(request).execute()) {
            assertThat(response.code()).isEqualTo(302);
            assertThat(response.header("Location")).isEqualTo("/swagger-ui/index.html");
        }

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
    }

    @Test
    void forwardedHeadersReflectOriginalClientRequest() throws Exception {
        upstream.enqueue(new MockResponse().setBody("ok"));

        ResponseEntity<String> response = restTemplate.getForEntity(gatewayUrl("/api/echo"), String.class);
        assertThat(response.getStatusCode().value()).isEqualTo(200);

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getHeader("X-Forwarded-Host")).isEqualTo("localhost:" + port);
        assertThat(recorded.getHeader("X-Forwarded-Proto")).isEqualTo("http");
        assertThat(recorded.getHeader("X-Forwarded-For")).isNotBlank();
    }

    @Test
    void encodedReservedCharactersInQueryDoNotCause500() throws Exception {
        upstream.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("[]"));

        // 예약 문자({, }, 공백, |)가 퍼센트 인코딩된 쿼리 — 게이트웨이는 그대로 통과시켜야 한다.
        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        java.net.http.HttpRequest request = java.net.http.HttpRequest
                .newBuilder(URI.create(gatewayUrl("/api/items?q=%7Ba%20b%7D%7Cc&page=1")))
                .GET()
                .build();
        java.net.http.HttpResponse<String> response =
                client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
        assertThat(recorded.getPath()).isEqualTo("/api/items?q=%7Ba%20b%7D%7Cc&page=1");
    }

    @Test
    void largeBinaryResponseBodyIsRelayedByteIdentical() throws Exception {
        byte[] payload = new byte[512 * 1024];
        new Random(7).nextBytes(payload);
        upstream.enqueue(new MockResponse()
                .setHeader("Content-Type", "application/octet-stream")
                .setBody(new Buffer().write(payload)));

        ResponseEntity<byte[]> response =
                restTemplate.getForEntity(gatewayUrl("/uploads/blob.bin"), byte[].class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(payload);

        RecordedRequest recorded = upstream.takeRequest(5, TimeUnit.SECONDS);
        assertThat(recorded).isNotNull();
    }
}
