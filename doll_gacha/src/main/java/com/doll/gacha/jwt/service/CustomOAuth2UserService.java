package com.doll.gacha.jwt.service;

import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.model.OAuthProvider;
import com.doll.gacha.jwt.model.UserDTO;
import com.doll.gacha.jwt.repository.UserRepository;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
    @Autowired
    private UserRepository userRepository;
    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // 외부 provider userinfo 호출(super.loadUser)은 트랜잭션 밖. DB 갱신은 아래 명시적 save 로 반영한다.
        OAuth2User oAuth2User = super.loadUser(userRequest);
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attributes = oAuth2User.getAttributes();
        // 1. 제공자별 엔티티 생성 로직 호출 (ENUM 활용)
        OAuthProvider currentLoginProvider = OAuthProvider.from(registrationId);

        UserDTO oauth2UseDTO = currentLoginProvider.toUserEntity(attributes);
        UserEntity extractUser = oauth2UseDTO.toEntity();

        // 2. DB 조회 (Optional 사용)
        UserEntity userEntity = userRepository.findByUsername(extractUser.getUsername())
            .orElse(null);

        if (userEntity == null) {  //처음 로그인이면...
            // 3-1. 신규 유저: 저장
            userEntity = userRepository.save(extractUser);
        } else {
            // 3-2. 기존 유저: 정보 업데이트 (이메일, 닉네임 등 변경 대비)
            //   @Transactional 제거로 dirty checking 이 안 되므로 명시적 save 로 반영한다.
            userEntity.setEmail(extractUser.getEmail());
            userEntity.setNickname(extractUser.getNickname());
            userEntity = userRepository.save(userEntity);
        }
        UserDTO userDTO = UserDTO.from(userEntity);
        return new CustomUserAccount(userDTO, attributes);
    }

}