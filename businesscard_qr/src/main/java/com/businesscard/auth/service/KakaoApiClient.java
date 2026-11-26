package com.businesscard.auth.service;

import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.UnauthorizedException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/**
 * 카카오 API 와 이야기하는 부분 — 호출·응답 해석·토큰 출처 검증.
 *
 * <p>{@link AuthService} 는 "누구인지 확인하고 우리 토큰을 발급한다" 는 흐름만 맡고,
 * 외부 시스템의 사정(HTTP·JSON 모양·필드 길이)은 여기서 흡수한다.
 */
@Component
@RequiredArgsConstructor
public class KakaoApiClient {

    /** UserEntity 의 email / nickname 컬럼 길이와 같은 값이다. */
    private static final int MAX_EMAIL_LENGTH = 100;
    private static final int MAX_NICKNAME_LENGTH = 100;

    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${app.kakao.user-info-uri:https://kapi.kakao.com/v2/user/me}")
    private String userInfoUri;

    @Value("${app.kakao.token-info-uri:https://kapi.kakao.com/v1/user/access_token_info}")
    private String tokenInfoUri;

    @Value("${app.kakao.expected-app-id:}")
    private String expectedAppId;

    // ── 웹 로그인(인가 코드 방식) ── 설계 웹앱_전환_설계.md §3-4

    @Value("${app.kakao.authorize-uri:https://kauth.kakao.com/oauth/authorize}")
    private String authorizeUri;

    @Value("${app.kakao.token-uri:https://kauth.kakao.com/oauth/token}")
    private String tokenUri;

    /**
     * 카카오 개발자센터의 <b>REST API 키</b>. 네이티브 앱 키·JavaScript 키와 다른 값이다.
     * 비어 있으면 웹 로그인이 꺼진다.
     */
    @Value("${app.kakao.rest-api-key:}")
    private String restApiKey;

    /** 카카오 콘솔에서 "Client Secret" 을 켰을 때만 넣는다. 켜 두는 것을 권장한다. */
    @Value("${app.kakao.client-secret:}")
    private String clientSecret;

    public boolean isWebLoginConfigured() {
        return restApiKey != null && !restApiKey.isBlank();
    }

    /** 사용자를 보낼 카카오 동의 화면 주소. */
    public URI authorizeUrl(String state, String redirectUri) {
        return org.springframework.web.util.UriComponentsBuilder.fromHttpUrl(authorizeUri)
                .queryParam("client_id", restApiKey)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("state", state)
                .encode()
                .build()
                .toUri();
    }

    /**
     * 인가 코드를 카카오 액세스 토큰으로 바꾼다.
     *
     * <p><b>왜 서버에서 하나:</b> 이 교환에는 Client Secret 이 들어간다. 브라우저에서 하면
     * 비밀값이 모든 방문자에게 노출된다. 그리고 토큰이 JS 에 한 번도 닿지 않으니
     * XSS 로 빼낼 길도 없다.
     *
     * <p>{@code redirectUri} 는 동의 화면에 보냈던 값과 <b>정확히 같아야</b> 카카오가 받아 준다.
     */
    public String exchangeCode(String code, String redirectUri) {
        if (code == null || code.isBlank()) {
            throw new BusinessRuleException("kakao authorization code is required.");
        }

        StringBuilder form = new StringBuilder()
                .append("grant_type=authorization_code")
                .append("&client_id=").append(urlEncode(restApiKey))
                .append("&redirect_uri=").append(urlEncode(redirectUri))
                .append("&code=").append(urlEncode(code));
        if (clientSecret != null && !clientSecret.isBlank()) {
            form.append("&client_secret=").append(urlEncode(clientSecret));
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(tokenUri))
                .timeout(Duration.ofSeconds(10))
                .header(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded;charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(form.toString()))
                .build();

        HttpResponse<String> response = sendRequest(request);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            // 만료·재사용된 코드, 등록 안 된 redirect_uri 등. 본문엔 코드가 섞일 수 있어 남기지 않는다.
            throw new UnauthorizedException("Kakao authorization code exchange failed.");
        }

        try {
            JsonNode accessToken = objectMapper.readTree(response.body()).get("access_token");
            if (accessToken == null || accessToken.isNull() || accessToken.asText().isBlank()) {
                throw new UnauthorizedException("Kakao token response has no access token.");
            }
            return accessToken.asText();
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to parse kakao token response.");
        }
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value == null ? "" : value, java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * 이 액세스 토큰이 <b>우리 앱에서 발급된 것</b>인지 확인한다.
     *
     * <p>이걸 건너뛰면 다른 카카오 앱이 발급한 토큰으로도 로그인이 통과한다.
     * 카카오 회원번호는 앱마다 따로 부여되므로 id 공간이 겹치면 <b>남의 계정으로 로그인</b>될 수 있다
     * (access token audience confusion). 그래서 운영에서는 {@code APP_KAKAO_EXPECTED_APP_ID} 가
     * 없으면 {@code RailwayDeploymentValidator} 가 아예 부팅을 막는다.
     */
    public void verifyTokenAudience(String kakaoAccessToken) {
        if (expectedAppId == null || expectedAppId.isBlank()) {
            return;
        }
        requireToken(kakaoAccessToken);

        JsonNode root = getJson(tokenInfoUri, kakaoAccessToken);
        JsonNode appId = root.get("app_id");
        if (appId == null || appId.isNull() || !expectedAppId.trim().equals(appId.asText())) {
            throw new UnauthorizedException("Invalid kakao token.");
        }
    }

    public KakaoUserProfile fetchUserProfile(String kakaoAccessToken) {
        requireToken(kakaoAccessToken);

        JsonNode root = getJson(userInfoUri, kakaoAccessToken);
        JsonNode idNode = root.get("id");
        if (idNode == null || idNode.isNull()) {
            throw new UnauthorizedException("Invalid kakao profile.");
        }

        JsonNode account = root.path("kakao_account");
        // 카카오가 주는 값은 우리가 통제하지 못한다. 컬럼 길이를 넘으면 저장이 터져
        // **로그인 자체가 500 으로 실패**하므로, 들어오는 경계에서 잘라 둔다.
        return new KakaoUserProfile(
                idNode.asText(),
                truncate(textOrNull(account.path("email")), MAX_EMAIL_LENGTH),
                truncate(textOrNull(account.path("profile").path("nickname")), MAX_NICKNAME_LENGTH));
    }

    private JsonNode getJson(String uri, String kakaoAccessToken) {
        HttpResponse<String> response = send(uri, kakaoAccessToken);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new UnauthorizedException("Invalid kakao token.");
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to parse kakao response.");
        }
    }

    private HttpResponse<String> send(String uri, String kakaoAccessToken) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(uri))
                // 카카오가 응답하지 않을 때 요청 스레드가 무한히 잡히지 않도록 상한을 둔다.
                .timeout(Duration.ofSeconds(10))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + kakaoAccessToken)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();
        return sendRequest(request);
    }

    /** 실제 전송. 네트워크 실패는 "카카오 확인 불가"로 통일한다 — 인증을 통과시키지 않는 쪽으로. */
    private HttpResponse<String> sendRequest(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UnauthorizedException("Failed to reach kakao.");
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to reach kakao.");
        }
    }

    private void requireToken(String kakaoAccessToken) {
        if (kakaoAccessToken == null || kakaoAccessToken.isBlank()) {
            throw new BusinessRuleException("kakao access token is required.");
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText();
        return text == null || text.isBlank() ? null : text;
    }
}
