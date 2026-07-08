package com.doll.gacha.jwt.model;

import com.doll.gacha.jwt.entity.UserEntity;
import java.util.Map;

public enum OAuthProvider {
    GOOGLE("google") {
        @Override
        public UserDTO toUserEntity(Map<String, Object> attributes) {
            UserDTO user = new UserDTO();
            user.setProvider(this.getRegistrationId());
            user.setUsername(this.getRegistrationId()+(String) attributes.get("sub"));  //google15432323
            user.setPassword("{noop}oauth2user");
            user.setEmail((String) attributes.get("email"));
            user.setNickname((String) attributes.get("name"));
            user.getRoles().add("USER");
            return user;
        }
    },
    KAKAO("kakao") {
        @Override
        public UserDTO toUserEntity(Map<String, Object> attributes) {
            // 카카오 데이터 계층 구조 분해
            Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
            Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
            Long id = (Long) attributes.get("id");

            UserDTO user = new UserDTO();
            user.setProvider(this.getRegistrationId());
            user.setUsername(this.getRegistrationId() + id);
            user.setPassword("{noop}oauth2user");
            user.setEmail((String) kakaoAccount.get("email"));
            user.setNickname((String) profile.get("nickname")); // profile 안에서 nickname 추출
            user.getRoles().add("USER");
            return user;
        }
    };





    private final String registrationId;
    OAuthProvider(String registrationId) {
        this.registrationId = registrationId;
    }

    public String getRegistrationId() {
        return registrationId;
    }

    public static OAuthProvider from(String registrationId) {
        for (OAuthProvider provider : OAuthProvider.values()) {
            if (provider.getRegistrationId().equalsIgnoreCase(registrationId)) { //대소문자구분없이.
                return provider;
            }
        }
        throw new IllegalArgumentException("Unknown provider: " + registrationId);
    }
    public abstract UserDTO toUserEntity(Map<String, Object> attributes);

}