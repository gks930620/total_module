package com.businesscard.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record KakaoLoginRequest(
        @NotBlank(message = "kakaoAccessToken is required.")
        String kakaoAccessToken
) {
}
