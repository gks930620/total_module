package com.doll.gacha.jwt;

import com.doll.gacha.common.exception.BusinessRuleException;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.RefreshRepository;
import com.doll.gacha.jwt.repository.UserRepository;
import com.doll.gacha.jwt.service.SocialTokenVerifier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * AppOAuth2Controller 테스트 (보안 재설계 후)
 *
 * 핵심: 앱이 보낸 provider access token 을 서버가 검증한 뒤에만 JWT 를 발급한다.
 * 테스트에서는 실제 provider 를 호출하지 않도록 SocialTokenVerifier 를 스텁으로 주입한다.
 * 스텁 규약: accessToken = "id|email|nickname" 를 파싱해 SocialUser 로 반환,
 *           "invalid" 이면 검증 실패(BusinessRuleException).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AppOAuth2ControllerTest {

    @TestConfiguration
    static class StubConfig {
        @Bean
        @Primary
        SocialTokenVerifier stubVerifier() {
            return (provider, accessToken) -> {
                if ("invalid".equals(accessToken)) {
                    throw new BusinessRuleException(provider + " 토큰 검증에 실패했습니다.");
                }
                String[] p = accessToken.split("\\|", -1);
                String id = p[0];
                String email = p.length > 1 && !p[1].isEmpty() ? p[1] : null;
                String nickname = p.length > 2 && !p[2].isEmpty() ? p[2] : null;
                return new SocialTokenVerifier.SocialUser(id, email, nickname);
            };
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshRepository refreshRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private ResultActions appLogin(String provider, String accessToken) throws Exception {
        return mockMvc.perform(post("/api/oauth2/" + provider + "/app")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(Map.of("accessToken", accessToken))));
    }

    // ==================== 정상 흐름 ====================

    @Test
    @DisplayName("검증된 구글 토큰 → 신규 사용자 생성 + 토큰 발급 + refresh DB 저장")
    void google_newUser_success() throws Exception {
        appLogin("google", "123456789|test@gmail.com|테스트유저")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.access_token").exists())
            .andExpect(jsonPath("$.data.refresh_token").exists());

        Optional<UserEntity> saved = userRepository.findByUsername("google123456789");
        assertThat(saved).isPresent();
        assertThat(saved.get().getEmail()).isEqualTo("test@gmail.com");
        assertThat(saved.get().getNickname()).isEqualTo("테스트유저");
        assertThat(saved.get().getProvider()).isEqualTo("google");
        // 앱 사용자도 refresh 가 DB 에 저장되어 재발급이 가능해야 한다
        assertThat(refreshRepository.existsByUserEntity_Username("google123456789")).isTrue();
    }

    @Test
    @DisplayName("검증된 구글 토큰 → 기존 사용자 정보 업데이트")
    void google_existingUser_update() throws Exception {
        userRepository.save(UserEntity.builder()
            .username("google123456789").email("old@gmail.com").nickname("기존유저")
            .password("{noop}oauth2user").provider("google").build());

        appLogin("google", "123456789|new@gmail.com|업데이트유저")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        UserEntity updated = userRepository.findByUsername("google123456789").orElseThrow();
        assertThat(updated.getEmail()).isEqualTo("new@gmail.com");
        assertThat(updated.getNickname()).isEqualTo("업데이트유저");
    }

    @Test
    @DisplayName("닉네임 없으면 기본값(구글사용자) 사용")
    void google_noNickname_default() throws Exception {
        appLogin("google", "987654321|test@gmail.com|")
            .andExpect(status().isOk());
        assertThat(userRepository.findByUsername("google987654321").orElseThrow().getNickname())
            .isEqualTo("구글사용자");
    }

    @Test
    @DisplayName("카카오: 이메일 미동의여도 성공, 빈 문자열 저장")
    void kakao_noEmail_success() throws Exception {
        appLogin("kakao", "1111111111||이메일없는유저")
            .andExpect(status().isOk());
        UserEntity saved = userRepository.findByUsername("kakao1111111111").orElseThrow();
        assertThat(saved.getEmail()).isEqualTo("");
        assertThat(saved.getNickname()).isEqualTo("이메일없는유저");
    }

    // ==================== 보안: 무효/누락 토큰 거부 ====================

    @Test
    @DisplayName("검증 실패한 토큰이면 400 (계정 발급 안 됨)")
    void invalidToken_rejected() throws Exception {
        mockMvc.perform(post("/api/oauth2/google/app")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("accessToken", "invalid"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("accessToken 누락이면 400")
    void missingToken_rejected() throws Exception {
        mockMvc.perform(post("/api/oauth2/google/app")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }
}
