package com.doll.gacha.jwt;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SecurityConfig 인가 규칙 회귀 테스트.
 *
 * 과거 버그: 메서드 없는 permitAll("/api/community", "/api/community/{id}") 가
 * POST/PUT/DELETE 까지 열어버려 쓰기 인증 규칙이 죽어 있었고(비인증 쓰기 → 컨트롤러 NPE 500),
 * 파일 삭제(DELETE /api/files/**) 는 아예 인증 없이 열려 있었다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("SecurityConfig 인가 규칙")
class SecurityAuthorizationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("커뮤니티 목록 GET 은 비인증 공개")
    void communityListGet_public() throws Exception {
        mockMvc.perform(get("/api/community"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("비인증 커뮤니티 작성(POST)은 401 (500 아님)")
    void communityWrite_unauthenticated_401() throws Exception {
        mockMvc.perform(post("/api/community")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"t\",\"content\":\"c\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비인증 커뮤니티 삭제(DELETE, 숫자 id)는 401")
    void communityDelete_unauthenticated_401() throws Exception {
        mockMvc.perform(delete("/api/community/5"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비인증 파일 삭제(DELETE)는 401")
    void fileDelete_unauthenticated_401() throws Exception {
        mockMvc.perform(delete("/api/files/1"))
            .andExpect(status().isUnauthorized());
    }

    // ===== 화이트리스트 방식 (anyRequest().authenticated()) 검증 =====

    @Test
    @DisplayName("공개 조회는 화이트리스트에 있어 비인증 접근 가능 (매장 리뷰 조회)")
    void publicRead_reviews_ok() throws Exception {
        // 시드된 매장(857)의 리뷰 조회는 공개 → 비인증 200
        mockMvc.perform(get("/api/reviews/doll-shop/857"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("화이트리스트에 없는 임의 API 는 비인증 시 401 (기존엔 permitAll 로 열려있었음)")
    void unlistedEndpoint_requiresAuth() throws Exception {
        mockMvc.perform(get("/api/this-endpoint-is-not-whitelisted"))
            .andExpect(status().isUnauthorized());
    }
}
