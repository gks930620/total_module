package com.test.test.jwt.controller;

import com.businesscard.common.dto.ApiResponse;
import com.test.test.jwt.JwtUtil;
import com.test.test.jwt.entity.UserEntity;
import com.test.test.jwt.repository.UserRepository;
import com.test.test.jwt.service.RefreshService;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/oauth2/providers")
@RequiredArgsConstructor
public class AppOAuth2Controller {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final RefreshService refreshService;

    @PostMapping("/{provider}/tokens")
    public ResponseEntity<ApiResponse<Map<String, String>>> oauthAppLogin(
            @PathVariable("provider") String provider,
            @RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            String email = request.get("email");
            String nickname = request.get("nickname") != null
                    ? request.get("nickname")
                    : request.get("displayName");

            if (id == null) {
                return ResponseEntity.badRequest()
                        .body(ApiResponse.fail(provider + " id is required"));
            }

            String username = provider + id;
            String defaultNickname = "google".equalsIgnoreCase(provider) ? "Google User" : "Kakao User";

            UserEntity user = userRepository.findByUsername(username).orElse(null);
            if (user == null) {
                user = UserEntity.builder()
                        .username(username)
                        .email(email != null ? email : "")
                        .nickname(nickname != null ? nickname : defaultNickname)
                        .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                        .provider(provider.toLowerCase())
                        .roles(new ArrayList<>())
                        .isActive(true)
                        .build();
                user.getRoles().add("USER");
                userRepository.save(user);
            } else {
                if (email != null) {
                    user.setEmail(email);
                }
                if (nickname != null) {
                    user.setNickname(nickname);
                }
                userRepository.save(user);
            }

            String accessToken = jwtUtil.createAccessToken(username);
            String refreshToken = jwtUtil.createRefreshToken(username);
            refreshService.saveRefresh(refreshToken);

            Map<String, String> tokenData = Map.of(
                    "access_token", accessToken,
                    "refresh_token", refreshToken
            );

            return ResponseEntity.ok(ApiResponse.success("OAuth login success", tokenData));
        } catch (Exception e) {
            log.error("{} OAuth login failed", provider, e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.fail("OAuth login failed: " + e.getMessage()));
        }
    }
}
