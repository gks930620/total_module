package com.businesscard.auth.controller;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.dto.KakaoLoginRequest;
import com.businesscard.auth.service.AuthService;
import com.businesscard.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/kakao")
    public ResponseEntity<ApiResponse<AuthTokenResponse>> loginWithKakao(
            @Valid @RequestBody KakaoLoginRequest request
    ) {
        AuthTokenResponse data = authService.loginWithKakaoAccessToken(request.kakaoAccessToken());
        return ResponseEntity.ok(ApiResponse.success("Login success", data));
    }
}
