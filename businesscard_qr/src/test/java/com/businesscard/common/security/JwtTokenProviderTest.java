package com.businesscard.common.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {

    private static final String SECRET = "test-jwt-secret-key-at-least-32-characters-long";

    private final JwtTokenProvider provider = new JwtTokenProvider(SECRET, 3600, 1209600);

    @Test
    void accessToken_isValid_butNotRefreshToken() {
        String access = provider.createAccessToken("kakao_1");

        assertThat(provider.isValid(access)).isTrue();
        assertThat(provider.isRefreshToken(access)).isFalse();
        assertThat(provider.getUserId(access)).isEqualTo("kakao_1");
    }

    @Test
    void refreshToken_isRecognizedAsRefresh() {
        String refresh = provider.createRefreshToken("kakao_1");

        assertThat(provider.isValid(refresh)).isTrue();
        assertThat(provider.isRefreshToken(refresh)).isTrue();
        assertThat(provider.getUserId(refresh)).isEqualTo("kakao_1");
    }

    @Test
    void garbageToken_isRejected() {
        assertThat(provider.isValid("not-a-jwt")).isFalse();
        assertThat(provider.isRefreshToken("not-a-jwt")).isFalse();
    }
}
