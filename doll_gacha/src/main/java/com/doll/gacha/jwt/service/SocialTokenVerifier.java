package com.doll.gacha.jwt.service;

/**
 * 앱 네이티브 OAuth 로그인 시, 앱이 전달한 소셜 provider 의 access token 을
 * 서버가 직접 provider 에 물어 검증한다. (클라이언트가 보낸 id 를 그대로 믿으면
 * 계정 탈취가 가능하므로 반드시 provider 검증을 거쳐야 한다.)
 */
public interface SocialTokenVerifier {

    /**
     * provider access token 을 검증하고 신뢰 가능한 사용자 식별 정보를 반환한다.
     * 검증 실패 시 {@link com.doll.gacha.common.exception.BusinessRuleException} 을 던진다.
     */
    SocialUser verify(String provider, String accessToken);

    /** provider 가 검증해준(신뢰 가능한) 사용자 정보 */
    record SocialUser(String id, String email, String nickname) {}
}
