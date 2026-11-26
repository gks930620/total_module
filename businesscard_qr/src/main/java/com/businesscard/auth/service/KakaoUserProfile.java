package com.businesscard.auth.service;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 카카오에서 받아 온 사용자 정보. record 가 아니라 class 다 — 코드컨벤션 §0.
 *
 * <p>email·nickname 은 카카오가 주지 않을 수도 있어 null 이 될 수 있다.
 */
@Getter
@AllArgsConstructor
public class KakaoUserProfile {

    /** 카카오 회원번호. 우리 사용자 id 는 여기에 {@code kakao_} 를 붙여 만든다. */
    private final String kakaoId;

    private final String email;
    private final String nickname;
}
