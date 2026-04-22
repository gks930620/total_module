package com.businesscard.auth.dto;

public record AuthTokenResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        String userId
) {
    public static AuthTokenResponse bearer(String accessToken, long expiresIn, String userId) {
        return new AuthTokenResponse(accessToken, "Bearer", expiresIn, userId);
    }
}
