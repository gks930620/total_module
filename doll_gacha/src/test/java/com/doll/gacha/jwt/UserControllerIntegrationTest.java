package com.doll.gacha.jwt;

import com.doll.gacha.common.WithMockCustomUser;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("User Controller 통합 테스트")
class UserControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        // 테스트 유저 생성
        UserEntity user = UserEntity.builder()
                .username("testuser")
                .password(passwordEncoder.encode("password123"))
                .email("test@example.com")
                .nickname("테스터")
                .build();
        userRepository.save(user);
    }

    @Test
    @DisplayName("내 정보 조회 - 로그인 사용자")
    @WithMockCustomUser(username = "testuser")
    void getMyInfo_success() throws Exception {
        mockMvc.perform(get("/api/my/info"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value("testuser"))
                .andExpect(jsonPath("$.data.email").exists())
                .andExpect(jsonPath("$.data.nickname").exists());
    }

    @Test
    @DisplayName("내 정보 조회 - 인증 없이 요청 시 실패")
    void getMyInfo_unauthorized() throws Exception {
        mockMvc.perform(get("/api/my/info"))
                .andDo(print())
                .andExpect(status().isUnauthorized());
    }
}

