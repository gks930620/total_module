package com.doll.gacha.jwt.service;

import com.doll.gacha.common.exception.BusinessRuleException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * provider(구글/카카오) userinfo 엔드포인트를 실제로 호출해 access token 을 검증한다.
 * 유효한 토큰이면 provider 가 내려주는 식별 정보(sub/id, email, nickname)만 신뢰한다.
 */
@Slf4j
@Component
public class HttpSocialTokenVerifier implements SocialTokenVerifier {

    private static final String GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
    private static final String KAKAO_USERINFO = "https://kapi.kakao.com/v2/user/me";

    private final RestClient restClient = RestClient.create();

    @Override
    public SocialUser verify(String provider, String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new BusinessRuleException("소셜 accessToken이 필요합니다.");
        }
        return switch (provider == null ? "" : provider.toLowerCase()) {
            case "google" -> verifyGoogle(accessToken);
            case "kakao" -> verifyKakao(accessToken);
            default -> throw new BusinessRuleException("지원하지 않는 provider 입니다: " + provider);
        };
    }

    @SuppressWarnings("unchecked")
    private SocialUser verifyGoogle(String accessToken) {
        try {
            Map<String, Object> body = restClient.get()
                .uri(GOOGLE_USERINFO)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);

            if (body == null || body.get("sub") == null) {
                throw new BusinessRuleException("구글 토큰 검증에 실패했습니다.");
            }
            return new SocialUser(
                String.valueOf(body.get("sub")),
                asString(body.get("email")),
                asString(body.get("name"))
            );
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("구글 토큰 검증 실패: {}", e.getMessage());
            throw new BusinessRuleException("구글 토큰 검증에 실패했습니다.");
        }
    }

    @SuppressWarnings("unchecked")
    private SocialUser verifyKakao(String accessToken) {
        try {
            Map<String, Object> body = restClient.get()
                .uri(KAKAO_USERINFO)
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);

            if (body == null || body.get("id") == null) {
                throw new BusinessRuleException("카카오 토큰 검증에 실패했습니다.");
            }
            String email = null;
            String nickname = null;
            if (body.get("kakao_account") instanceof Map<?, ?> account) {
                email = asString(account.get("email"));
                if (account.get("profile") instanceof Map<?, ?> profile) {
                    nickname = asString(profile.get("nickname"));
                }
            }
            return new SocialUser(String.valueOf(body.get("id")), email, nickname);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("카카오 토큰 검증 실패: {}", e.getMessage());
            throw new BusinessRuleException("카카오 토큰 검증에 실패했습니다.");
        }
    }

    private String asString(Object o) {
        return o != null ? String.valueOf(o) : null;
    }
}
