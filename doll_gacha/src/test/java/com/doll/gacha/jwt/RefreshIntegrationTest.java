package com.doll.gacha.jwt;

import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import com.doll.gacha.jwt.service.RefreshService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Refresh Controller 통합 테스트")
class RefreshIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RefreshService refreshService;

    private String validRefreshToken;

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

        // 유효한 refresh 토큰 생성 및 저장
        validRefreshToken = jwtUtil.createRefreshToken("testuser");
        refreshService.saveRefresh(validRefreshToken);
    }

    @Test
    @DisplayName("토큰 재발급 성공 - 앱 (Authorization 헤더)")
    void reissue_success_app() throws Exception {
        mockMvc.perform(post("/api/refresh/reissue")
                        .header("Authorization", "Bearer " + validRefreshToken))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.access_token").exists())
                .andExpect(jsonPath("$.data.refresh_token").exists());
    }

    @Test
    @DisplayName("토큰 재발급 성공 - 웹 (쿠키)")
    void reissue_success_web() throws Exception {
        // 쿠키로 refresh_token 전송 (Authorization 헤더 없이)
        // 실제 브라우저는 Accept: text/html, application/json 등 여러 타입을 보냄
        mockMvc.perform(post("/api/refresh/reissue")
                        .cookie(new jakarta.servlet.http.Cookie("refresh_token", validRefreshToken)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                // 웹은 쿠키로 토큰 응답하므로 data는 null
                .andExpect(cookie().exists("access_token"))
                .andExpect(cookie().exists("refresh_token"));
    }

    @Test
    @DisplayName("토큰 재발급 실패 - 유효하지 않은 토큰")
    // [요청 흐름]
    // 1. 잘못된 형식의 토큰으로 POST /api/refresh/reissue 요청
    // 2. JwtAccessTokenCheckAndSaveUserInfoFilter에서 토큰 파싱 시 JwtException 발생
    //    → catch 블록에서 ERROR_CAUSE="잘못된토큰" 설정 후 체인 통과
    // 3. /api/refresh/reissue는 permitAll()이므로 Security Authorization 통과
    // 4. RefreshController.refreshAccessToken()에서 DB에서 토큰 조회 → 없음
    //    → ErrorResponse(TOKEN_DISCARDED) 반환
    void reissue_invalidToken() throws Exception {
        mockMvc.perform(post("/api/refresh/reissue")
                        .header("Authorization", "Bearer invalid_token_string"))
                .andDo(print())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("토큰 재발급 실패 - 폐기된 토큰")
    void reissue_discardedToken() throws Exception {
        // 토큰 폐기
        refreshService.deleteRefresh(validRefreshToken);

        mockMvc.perform(post("/api/refresh/reissue")
                        .header("Authorization", "Bearer " + validRefreshToken))
                .andDo(print())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("TOKEN_DISCARDED"));
    }

    @Test
    @DisplayName("토큰 재발급 실패 - Authorization 헤더 누락")
    void reissue_noHeader() throws Exception {
        mockMvc.perform(post("/api/refresh/reissue"))
                .andDo(print())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("TOKEN_REQUIRED"));
    }
}

