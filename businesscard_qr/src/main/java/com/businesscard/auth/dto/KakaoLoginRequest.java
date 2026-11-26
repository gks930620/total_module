package com.businesscard.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 카카오 액세스 토큰으로 로그인. record 가 아니라 class 다 — 코드컨벤션 §0. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KakaoLoginRequest {

    @NotBlank(message = "kakaoAccessToken is required.")
    private String kakaoAccessToken;
}
