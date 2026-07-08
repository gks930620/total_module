package com.businesscard.auth.dto;

public record AuthTokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        String userId
) {
    public static AuthTokenResponse bearer(String accessToken, String refreshToken, long expiresIn, String userId) {
        return new AuthTokenResponse(accessToken, refreshToken, "Bearer", expiresIn, userId);
    }
}
