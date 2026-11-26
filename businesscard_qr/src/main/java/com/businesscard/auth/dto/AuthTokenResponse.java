package com.businesscard.auth.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * 로그인·토큰 갱신 응답.
 *
 * <p>record 가 아니라 class 다 — 코드컨벤션 §0. JSON 필드 이름은 record 시절과 같아
 * 앱 계약은 바뀌지 않는다.
 */
@Getter
@Builder
public class AuthTokenResponse {

    private final String accessToken;
    private final String refreshToken;
    private final String tokenType;
    private final long expiresIn;
    private final String userId;

    public static AuthTokenResponse bearer(
            String accessToken,
            String refreshToken,
            long expiresIn,
            String userId
    ) {
        return AuthTokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(expiresIn)
                .userId(userId)
                .build();
    }
}
