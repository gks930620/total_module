package com.businesscard.auth.service;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.UnauthorizedException;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.service.UserService;
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
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Value("${app.kakao.user-info-uri:https://kapi.kakao.com/v2/user/me}")
    private String kakaoUserInfoUri;

    @Value("${app.kakao.expected-app-id:}")
    private String kakaoExpectedAppId;

    @Value("${app.kakao.token-info-uri:https://kapi.kakao.com/v1/user/access_token_info}")
    private String kakaoTokenInfoUri;

    /**
     * 카카오 액세스 토큰으로 로그인한다.
     *
     * <p>카카오 HTTP 호출(최대 10초 블로킹)이 DB 커넥션/트랜잭션을 점유하지 않도록
     * 이 메서드에는 트랜잭션을 걸지 않는다. DB 작업은 {@code userService.syncKakaoUser}
     * (별도 빈의 @Transactional 메서드 → 프록시 적용)에서만 트랜잭션으로 수행되고,
     * JWT 발급은 트랜잭션이 필요 없다.
     */
    public AuthTokenResponse loginWithKakaoAccessToken(String kakaoAccessToken) {
        verifyKakaoTokenAudience(kakaoAccessToken);
        KakaoUserProfile profile = fetchKakaoUserProfile(kakaoAccessToken);
        UserEntity user = userService.syncKakaoUser(profile.kakaoId(), profile.email(), profile.nickname());
        return issueTokens(user.getId());
    }

    /**
     * 리프레시 토큰으로 새 액세스/리프레시 토큰을 발급한다(회전 방식).
     * 유효한 refresh 타입 토큰 + 실제 존재하는 사용자여야 한다.
     *
     * <p>DB 접근은 {@code userService.existsById}(자체 @Transactional(readOnly))뿐이므로
     * 여기서는 트랜잭션을 열지 않는다.
     */
    public AuthTokenResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !jwtTokenProvider.isRefreshToken(refreshToken)) {
            throw new UnauthorizedException("Invalid refresh token.");
        }
        String userId = jwtTokenProvider.getUserId(refreshToken);
        if (userId == null || userId.isBlank() || !userService.existsById(userId)) {
            throw new UnauthorizedException("Invalid refresh token.");
        }
        return issueTokens(userId);
    }

    private AuthTokenResponse issueTokens(String userId) {
        String accessToken = jwtTokenProvider.createAccessToken(userId);
        String refreshToken = jwtTokenProvider.createRefreshToken(userId);
        return AuthTokenResponse.bearer(
                accessToken,
                refreshToken,
                jwtTokenProvider.getAccessTokenValiditySeconds(),
                userId);
    }

    /**
     * (선택) 카카오 토큰이 우리 앱에서 발급된 것인지 검증한다.
     *
     * <p>app.kakao.expected-app-id(APP_KAKAO_EXPECTED_APP_ID)가 비어 있으면 검증을 건너뛴다.
     * 설정된 경우 토큰 정보 API의 app_id가 기대값과 다르면 다른 앱에서 발급된 토큰이므로 거부한다.
     */
    private void verifyKakaoTokenAudience(String kakaoAccessToken) {
        if (kakaoExpectedAppId == null || kakaoExpectedAppId.isBlank()) {
            return;
        }
        if (kakaoAccessToken == null || kakaoAccessToken.isBlank()) {
            throw new BusinessRuleException("kakao access token is required.");
        }

        HttpResponse<String> response = sendKakaoGet(kakaoTokenInfoUri, kakaoAccessToken);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new UnauthorizedException("Invalid kakao token.");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to parse kakao token info.");
        }

        JsonNode appIdNode = root.get("app_id");
        if (appIdNode == null || appIdNode.isNull() || !kakaoExpectedAppId.trim().equals(appIdNode.asText())) {
            throw new UnauthorizedException("Invalid kakao token.");
        }
    }

    private KakaoUserProfile fetchKakaoUserProfile(String kakaoAccessToken) {
        if (kakaoAccessToken == null || kakaoAccessToken.isBlank()) {
            throw new BusinessRuleException("kakao access token is required.");
        }

        HttpResponse<String> response = sendKakaoGet(kakaoUserInfoUri, kakaoAccessToken);
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new UnauthorizedException("Invalid kakao token.");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to parse kakao profile.");
        }

        JsonNode idNode = root.get("id");
        if (idNode == null || idNode.isNull()) {
            throw new UnauthorizedException("Invalid kakao profile.");
        }

        String kakaoId = idNode.asText();
        JsonNode kakaoAccountNode = root.path("kakao_account");
        String email = textOrNull(kakaoAccountNode.path("email"));
        String nickname = textOrNull(kakaoAccountNode.path("profile").path("nickname"));
        return new KakaoUserProfile(kakaoId, email, nickname);
    }

    private HttpResponse<String> sendKakaoGet(String uri, String kakaoAccessToken) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(uri))
                .timeout(Duration.ofSeconds(10))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + kakaoAccessToken)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UnauthorizedException("Failed to verify kakao token.");
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to verify kakao token.");
        }
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String text = node.asText();
        return text == null || text.isBlank() ? null : text;
    }

    private record KakaoUserProfile(
            String kakaoId,
            String email,
            String nickname
    ) {
    }
}
