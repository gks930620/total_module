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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.kakao.user-info-uri:https://kapi.kakao.com/v2/user/me}")
    private String kakaoUserInfoUri;

    @Transactional
    public AuthTokenResponse loginWithKakaoAccessToken(String kakaoAccessToken) {
        KakaoUserProfile profile = fetchKakaoUserProfile(kakaoAccessToken);
        UserEntity user = userService.syncKakaoUser(profile.kakaoId(), profile.email(), profile.nickname());
        String accessToken = jwtTokenProvider.createAccessToken(user.getId());
        return AuthTokenResponse.bearer(accessToken, jwtTokenProvider.getAccessTokenValiditySeconds(), user.getId());
    }

    private KakaoUserProfile fetchKakaoUserProfile(String kakaoAccessToken) {
        if (kakaoAccessToken == null || kakaoAccessToken.isBlank()) {
            throw new BusinessRuleException("kakao access token is required.");
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(kakaoUserInfoUri))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + kakaoAccessToken)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new UnauthorizedException("Failed to verify kakao token.");
        } catch (IOException e) {
            throw new UnauthorizedException("Failed to verify kakao token.");
        }

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
