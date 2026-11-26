package com.businesscard.auth.service;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.common.exception.UnauthorizedException;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 로그인 흐름 — "누구인지 확인하고 우리 토큰을 발급한다".
 *
 * <p>카카오와의 통신은 {@link KakaoApiClient} 가 맡는다. 여기에는 순서만 남긴다.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final KakaoApiClient kakaoApiClient;
    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * 카카오 액세스 토큰으로 로그인한다.
     *
     * <p>카카오 HTTP 호출(최대 10초 블로킹)이 DB 커넥션·트랜잭션을 점유하지 않도록
     * 이 메서드에는 트랜잭션을 걸지 않는다(코드컨벤션 §1). DB 작업은
     * {@code userService.syncKakaoUser}(별도 빈의 {@code @Transactional} → 프록시 적용)에서만
     * 트랜잭션으로 수행되고, JWT 발급은 트랜잭션이 필요 없다.
     */
    public AuthTokenResponse loginWithKakaoAccessToken(String kakaoAccessToken) {
        // ① 이 토큰이 우리 앱 것인지부터 본다 — 남의 앱 토큰으로 로그인되면 계정이 섞인다.
        kakaoApiClient.verifyTokenAudience(kakaoAccessToken);
        // ② 누구인지 받아 와서 ③ 우리 쪽 사용자와 맞춘다.
        KakaoUserProfile profile = kakaoApiClient.fetchUserProfile(kakaoAccessToken);
        UserEntity user = userService.syncKakaoUser(
                profile.getKakaoId(), profile.getEmail(), profile.getNickname());
        return issueTokens(user.getId());
    }

    /**
     * 웹 로그인 — 카카오 인가 코드로 로그인한다.
     *
     * <p>코드를 토큰으로 바꾸는 것만 다르고, 그 뒤는 앱 로그인({@link #loginWithKakaoAccessToken})과
     * <b>완전히 같은 길</b>을 탄다. 그래야 토큰 출처 검증·사용자 동기화 규칙이 채널마다 갈라지지 않는다.
     */
    public AuthTokenResponse loginWithKakaoCode(String code, String redirectUri) {
        String kakaoAccessToken = kakaoApiClient.exchangeCode(code, redirectUri);
        return loginWithKakaoAccessToken(kakaoAccessToken);
    }

    /**
     * 리프레시 토큰으로 새 액세스/리프레시 토큰을 발급한다(회전 방식).
     * 유효한 refresh 타입 토큰 + 실제 존재하는 사용자여야 한다.
     *
     * <p>DB 접근은 {@code userService.existsById}(자체 {@code @Transactional(readOnly)})뿐이라
     * 여기서는 트랜잭션을 열지 않는다.
     */
    public AuthTokenResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !jwtTokenProvider.isRefreshToken(refreshToken)) {
            throw new UnauthorizedException("Invalid refresh token.");
        }
        String userId = jwtTokenProvider.getUserId(refreshToken);
        if (userId == null || userId.isBlank() || !userService.existsById(userId)) {
            throw new UnauthorizedException("Invalid refresh token.");
        }
        return issueTokens(userId);
    }

    private AuthTokenResponse issueTokens(String userId) {
        return AuthTokenResponse.bearer(
                jwtTokenProvider.createAccessToken(userId),
                jwtTokenProvider.createRefreshToken(userId),
                jwtTokenProvider.getAccessTokenValiditySeconds(),
                userId);
    }
}
