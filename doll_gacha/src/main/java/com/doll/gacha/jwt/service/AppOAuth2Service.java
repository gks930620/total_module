package com.doll.gacha.jwt.service;

import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import com.doll.gacha.jwt.service.SocialTokenVerifier.SocialUser;
import java.util.ArrayList;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 앱 네이티브 OAuth 로그인 오케스트레이션.
 * 1) provider access token 을 검증(SocialTokenVerifier)
 * 2) 검증된 식별정보로 사용자 find-or-create
 * 3) 서비스 JWT(access/refresh) 발급 + refresh DB 저장(재발급 가능하도록)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppOAuth2Service {

    private final SocialTokenVerifier socialTokenVerifier;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final RefreshService refreshService;
    private final PasswordEncoder passwordEncoder;

    public Map<String, String> login(String provider, String accessToken) {
        // 외부 토큰 검증(HTTP)은 트랜잭션 밖에서 수행 — 느린 외부 호출이 DB 커넥션을 붙잡지 않도록.
        // 이후 DB 작업은 각 repository 호출(save 등)이 자체 트랜잭션으로 처리한다.
        SocialUser socialUser = socialTokenVerifier.verify(provider, accessToken);

        String normalizedProvider = provider.toLowerCase();
        String username = normalizedProvider + socialUser.id();
        String defaultNickname = "google".equals(normalizedProvider) ? "구글사용자" : "카카오사용자";

        UserEntity user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            user = UserEntity.builder()
                .username(username)
                .email(socialUser.email() != null ? socialUser.email() : "")
                .nickname(socialUser.nickname() != null ? socialUser.nickname() : defaultNickname)
                // OAuth 사용자는 비밀번호 로그인을 하지 않지만, {noop} 평문 대신
                // 랜덤 UUID 를 인코딩해 저장한다(웹 일반가입 경로와 동일한 정책).
                .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                .provider(normalizedProvider)
                .roles(new ArrayList<>())
                .isActive(true)
                .build();
            user.getRoles().add("USER");
            log.info("새 {} 앱 사용자 생성: {}", normalizedProvider, username);
        } else {
            if (socialUser.email() != null) user.setEmail(socialUser.email());
            if (socialUser.nickname() != null) user.setNickname(socialUser.nickname());
            log.info("기존 {} 앱 사용자 로그인: {}", normalizedProvider, username);
        }
        userRepository.save(user);

        String jwtAccess = jwtUtil.createAccessToken(username);
        String jwtRefresh = jwtUtil.createRefreshToken(username);
        // 웹/일반 로그인과 동일하게 refresh 를 DB 에 저장해야 재발급(/api/refresh/reissue)이 가능하다.
        refreshService.saveRefresh(jwtRefresh);

        return Map.of("access_token", jwtAccess, "refresh_token", jwtRefresh);
    }
}
