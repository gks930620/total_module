package com.doll.gacha.jwt;

import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional // 테스트 후 DB 롤백
class LoginIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        // 테스트용 유저 생성
        UserEntity user = UserEntity.builder()
                .username("testuser")
                .password(passwordEncoder.encode("password123"))
                .email("test@example.com")
                .nickname("테스터")
                .build();
        userRepository.save(user);
    }

    @Test
    @DisplayName("앱 로그인 성공: JSON 응답 확인")
    // [테스트 대상] JwtLoginFilter.successfulAuthentication()의 else 블록 (앱 분기)
    // 1. 클라이언트(앱)가 /api/login 으로 POST 요청 (username, password JSON 전송)
    // 2. [JwtLoginFilter.attemptAuthentication] 실행
    //    - request.getInputStream()으로 JSON 파싱하여 인증 토큰 생성
    //    - authenticationManager.authenticate() 호출 -> CustomUserDetailsService -> DB 검증
    // 3. 인증 성공 시 [JwtLoginFilter.successfulAuthentication] 실행
    //    - Access/Refresh 토큰 생성 및 DB 저장
    //    - request.getHeader("Accept") 확인 -> "text/html"이 없으므로 앱으로 판단
    // 4. JSON 형식으로 { "access_token": "...", "refresh_token": "..." } 응답 반환
    void loginSuccess_App() throws Exception {
        // given
        Map<String, String> loginRequest = Map.of(
                "username", "testuser",
                "password", "password123"
        );

        // when
        ResultActions result = mockMvc.perform(post("/api/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)));

        // then
        result.andExpect(status().isOk())
                .andExpect(content().contentType("application/json;charset=UTF-8"))
                .andExpect(jsonPath("$.access_token").exists())
                .andExpect(jsonPath("$.refresh_token").exists())
                .andDo(print());
    }

    @Test
    @DisplayName("웹 로그인 성공: 쿠키 응답 확인")
    // [테스트 대상] JwtLoginFilter.successfulAuthentication()의 if (isBrowser) 블록 (웹 분기)
    // 1. 클라이언트(브라우저)가 /api/login 으로 POST 요청
    //    - 헤더에 Accept: text/html 포함 (브라우저 기본 동작)
    // 2. [JwtLoginFilter.attemptAuthentication] 인증 수행 (앱과 동일)
    // 3. [JwtLoginFilter.successfulAuthentication] 실행
    //    - request.getHeader("Accept")에 "text/html" 포함 -> 웹으로 판단
    // 4. JSON 대신 HttpOnly 쿠키(access_token, refresh_token)를 응답 헤더(Set-Cookie)에 추가
    //    - maxAge: -1 (세션 쿠키)
    void loginSuccess_Web() throws Exception {
        // given
        Map<String, String> loginRequest = Map.of(
                "username", "testuser",
                "password", "password123"
        );

        // when
        // 헤더에 Accept: text/html 추가
        ResultActions result = mockMvc.perform(post("/api/login")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Accept", "text/html")
                .content(objectMapper.writeValueAsString(loginRequest)));

        // then
        result.andExpect(status().isOk())
                .andExpect(cookie().exists("access_token"))
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andDo(print());
    }

    @Test
    @DisplayName("로그인 실패: 비밀번호 불일치")
    // [테스트 대상] JwtLoginFilter.unsuccessfulAuthentication()
    // 1. 클라이언트가 /api/login 으로 잘못된 비밀번호 전송
    // 2. [JwtLoginFilter.attemptAuthentication]
    //    → authenticationManager.authenticate() 에서 AuthenticationException 발생
    // 3. [JwtLoginFilter.unsuccessfulAuthentication] 실행
    //    → ErrorResponse 형식으로 401 + errorCode:"AUTHENTICATION_FAILED" 반환
    // ※ SecurityConfig.authenticationEntryPoint는 로그인 이외의 인증 필요 API에서 동작
    void loginFail_WrongPassword() throws Exception {
        // given
        Map<String, String> loginRequest = Map.of(
                "username", "testuser",
                "password", "wrongpassword"
        );

        // when
        ResultActions result = mockMvc.perform(post("/api/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)));

        // then
        result.andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("AUTHENTICATION_FAILED"))
                .andDo(print());
    }
}
