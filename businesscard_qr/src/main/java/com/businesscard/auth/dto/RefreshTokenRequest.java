package com.businesscard.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 리프레시 토큰으로 재발급. record 가 아니라 class 다 — 코드컨벤션 §0. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RefreshTokenRequest {

    @NotBlank(message = "refreshToken is required.")
    private String refreshToken;
}
