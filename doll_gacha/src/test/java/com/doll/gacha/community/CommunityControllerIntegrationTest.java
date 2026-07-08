package com.doll.gacha.community;

import com.doll.gacha.common.WithMockCustomUser;
import com.doll.gacha.community.dto.CommunityCreateDTO;
import com.doll.gacha.community.dto.CommunityUpdateDTO;
import com.doll.gacha.community.repository.CommunityRepository;
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
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Community Controller 통합 테스트")
class CommunityControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CommunityRepository communityRepository;

    private UserEntity testUser;
    private CommunityEntity testCommunity;

    @BeforeEach
    void setUp() {
        // 테스트 유저 생성
        testUser = UserEntity.builder()
                .username("testuser")
                .password(passwordEncoder.encode("password123"))
                .email("test@example.com")
                .nickname("테스터")
                .build();
        userRepository.save(testUser);

        // 테스트 게시글 생성
        testCommunity = CommunityEntity.builder()
                .user(testUser)
                .title("테스트 게시글")
                .content("테스트 내용입니다.")
                .viewCount(0)
                .isDeleted(false)
                .build();
        communityRepository.save(testCommunity);
    }

    @Test
    @DisplayName("게시글 목록 조회 (페이징)")
    void getCommunityList_success() throws Exception {
        mockMvc.perform(get("/api/community")
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.page").exists())
                .andExpect(jsonPath("$.data.totalElements").exists())
                .andExpect(jsonPath("$.data.totalPages").exists());
    }

    @Test
    @DisplayName("게시글 목록 검색 - 제목으로")
    void getCommunityList_searchByTitle() throws Exception {
        mockMvc.perform(get("/api/community")
                        .param("searchType", "title")
                        .param("keyword", "테스트")
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("게시글 목록 검색 - searchType 없이 keyword 만 (과거 NPE 500 회귀 방지)")
    // CommunityRepositoryImpl.searchCondition 이 searchType==null 일 때 switch(null) 로 NPE→500 났던 버그.
    // 공개 API 이므로 200 으로 정상 응답해야 한다. (제목 기준 검색으로 폴백)
    void getCommunityList_keywordOnly_noSearchType() throws Exception {
        mockMvc.perform(get("/api/community")
                        .param("keyword", "테스트")
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("게시글 상세 조회")
    void getCommunityDetail_success() throws Exception {
        mockMvc.perform(get("/api/community/{communityId}", testCommunity.getId()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(testCommunity.getId()))
                .andExpect(jsonPath("$.data.title").value("테스트 게시글"))
                .andExpect(jsonPath("$.data.content").value("테스트 내용입니다."));
    }

    @Test
    @DisplayName("게시글 상세 조회 - 존재하지 않는 게시글")
    void getCommunityDetail_notFound() throws Exception {
        mockMvc.perform(get("/api/community/{communityId}", 999999))
                .andDo(print())
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("게시글 작성 - 로그인 필요")
    @WithMockCustomUser(username = "testuser")
    void createCommunity_success() throws Exception {
        CommunityCreateDTO createDTO = CommunityCreateDTO.builder()
                .title("새 게시글")
                .content("새 게시글 내용입니다.")
                .build();

        mockMvc.perform(post("/api/community")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("게시글이 작성되었습니다"))
                .andExpect(jsonPath("$.data").isNumber()); // 생성된 게시글 ID 반환
    }

    @Test
    @DisplayName("게시글 작성 - 인증 없이 요청 시 401")
    // SecurityConfig 의 공개 permitAll 이 GET 전용으로 제한되면서,
    // 비인증 POST 는 컨트롤러에 도달하기 전에 AuthenticationEntryPoint 에서 401 로 차단된다.
    // (과거에는 permitAll 이 POST 까지 열려 컨트롤러 NPE 500 이 났었음 → 버그 수정됨)
    void createCommunity_unauthorized() throws Exception {
        CommunityCreateDTO createDTO = CommunityCreateDTO.builder()
                .title("새 게시글")
                .content("새 게시글 내용입니다.")
                .build();

        mockMvc.perform(post("/api/community")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("게시글 작성 - 유효성 검증 실패 (제목 없음)")
    @WithMockCustomUser(username = "testuser")
    void createCommunity_validationFail() throws Exception {
        CommunityCreateDTO createDTO = CommunityCreateDTO.builder()
                .title("")  // 빈 제목
                .content("내용입니다.")
                .build();

        mockMvc.perform(post("/api/community")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("게시글 수정 - 작성자만 가능")
    @WithMockCustomUser(username = "testuser")
    void updateCommunity_success() throws Exception {
        CommunityUpdateDTO updateDTO = CommunityUpdateDTO.builder()
                .title("수정된 제목")
                .content("수정된 내용")
                .build();

        mockMvc.perform(put("/api/community/{communityId}", testCommunity.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("게시글이 수정되었습니다"));
    }

    @Test
    @DisplayName("게시글 수정 - 다른 사용자는 수정 불가")
    @WithMockCustomUser(username = "otheruser")
    void updateCommunity_forbidden() throws Exception {
        CommunityUpdateDTO updateDTO = CommunityUpdateDTO.builder()
                .title("수정된 제목")
                .content("수정된 내용")
                .build();

        mockMvc.perform(put("/api/community/{communityId}", testCommunity.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("게시글 삭제 - 작성자만 가능 (Soft Delete)")
    @WithMockCustomUser(username = "testuser")
    void deleteCommunity_success() throws Exception {
        mockMvc.perform(delete("/api/community/{communityId}", testCommunity.getId()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("게시글 삭제 - 다른 사용자는 삭제 불가")
    @WithMockCustomUser(username = "otheruser")
    void deleteCommunity_forbidden() throws Exception {
        mockMvc.perform(delete("/api/community/{communityId}", testCommunity.getId()))
                .andDo(print())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }
}

