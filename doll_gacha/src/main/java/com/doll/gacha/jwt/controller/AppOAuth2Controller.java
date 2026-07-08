package com.doll.gacha.jwt.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.common.exception.BusinessRuleException;
import com.doll.gacha.jwt.service.AppOAuth2Service;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 앱 전용 OAuth2 로그인 컨트롤러 (얇은 계층 — 검증/발급은 Service 위임)
 *
 * 앱은 네이티브 SDK 로그인 후 받은 provider 의 access token 을 전달한다.
 * 서버는 이 토큰을 provider 에 직접 물어 검증한 뒤에만 서비스 JWT 를 발급한다.
 *
 * 요청 예: POST /api/oauth2/google/app  {"accessToken":"<provider access token>"}
 */
@Slf4j
@RestController
@RequestMapping("/api/oauth2")
@RequiredArgsConstructor
public class AppOAuth2Controller {

    private final AppOAuth2Service appOAuth2Service;

    @PostMapping("/{provider}/app")
    public ResponseEntity<ApiResponse<Map<String, String>>> oauthAppLogin(
            @PathVariable("provider") String provider,
            @RequestBody Map<String, String> request) {

        String accessToken = request.getOrDefault("accessToken", request.get("access_token"));
        if (accessToken == null || accessToken.isBlank()) {
            throw new BusinessRuleException(provider + " accessToken은 필수입니다.");
        }

        Map<String, String> tokens = appOAuth2Service.login(provider, accessToken);
        return ResponseEntity.ok(ApiResponse.success("로그인 성공", tokens));
    }
}
