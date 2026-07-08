package com.doll.gacha.community.comment;

import com.doll.gacha.common.WithMockCustomUser;
import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.community.repository.CommunityRepository;
import com.doll.gacha.community.comment.dto.CommentCreateDTO;
import com.doll.gacha.community.comment.dto.CommentUpdateDTO;
import com.doll.gacha.community.comment.repository.CommentRepository;
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
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Comment Controller 통합 테스트")
class CommentControllerIntegrationTest {

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

    @Autowired
    private CommentRepository commentRepository;

    private UserEntity testUser;
    private CommunityEntity testCommunity;
    private CommentEntity testComment;

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

        // 테스트 댓글 생성
        testComment = CommentEntity.builder()
                .community(testCommunity)
                .user(testUser)
                .content("테스트 댓글입니다.")
                .build();
        commentRepository.save(testComment);
    }

    @Test
    @DisplayName("특정 게시글의 댓글 목록 조회 (페이징)")
    void getComments_success() throws Exception {
        mockMvc.perform(get("/api/comments/community/{communityId}", testCommunity.getId())
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.page").exists())
                .andExpect(jsonPath("$.data.content[0].content").value("테스트 댓글입니다."));
    }

    @Test
    @DisplayName("존재하지 않는 게시글의 댓글 조회")
    void getComments_emptyResult() throws Exception {
        mockMvc.perform(get("/api/comments/community/{communityId}", 999999)
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @Test
    @DisplayName("댓글 작성 - 로그인 필요")
    @WithMockCustomUser(username = "testuser")
    void createComment_success() throws Exception {
        CommentCreateDTO createDTO = CommentCreateDTO.builder()
                .communityId(testCommunity.getId())
                .content("새 댓글입니다.")
                .build();

        mockMvc.perform(post("/api/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value("새 댓글입니다."))
                .andExpect(jsonPath("$.data.id").exists());
    }

    @Test
    @DisplayName("댓글 작성 - 인증 없이 요청 시 실패")
    void createComment_unauthorized() throws Exception {
        CommentCreateDTO createDTO = CommentCreateDTO.builder()
                .communityId(testCommunity.getId())
                .content("새 댓글입니다.")
                .build();

        mockMvc.perform(post("/api/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("댓글 작성 - 유효성 검증 실패 (내용 없음)")
    @WithMockCustomUser(username = "testuser")
    void createComment_validationFail() throws Exception {
        CommentCreateDTO createDTO = CommentCreateDTO.builder()
                .communityId(testCommunity.getId())
                .content("")  // 빈 내용
                .build();

        mockMvc.perform(post("/api/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("댓글 수정 - 작성자만 가능")
    @WithMockCustomUser(username = "testuser")
    void updateComment_success() throws Exception {
        CommentUpdateDTO updateDTO = CommentUpdateDTO.builder()
                .content("수정된 댓글입니다.")
                .build();

        mockMvc.perform(put("/api/comments/{commentId}", testComment.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value("수정된 댓글입니다."));
    }

    @Test
    @DisplayName("댓글 수정 - 다른 사용자는 수정 불가")
    @WithMockCustomUser(username = "otheruser")
    void updateComment_forbidden() throws Exception {
        CommentUpdateDTO updateDTO = CommentUpdateDTO.builder()
                .content("수정된 댓글입니다.")
                .build();

        mockMvc.perform(put("/api/comments/{commentId}", testComment.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("댓글 삭제 - 작성자만 가능")
    @WithMockCustomUser(username = "testuser")

    void deleteComment_success() throws Exception {
        mockMvc.perform(delete("/api/comments/{commentId}", testComment.getId()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("댓글 삭제 - 다른 사용자는 삭제 불가")
    @WithMockCustomUser(username = "otheruser")
    void deleteComment_forbidden() throws Exception {
        mockMvc.perform(delete("/api/comments/{commentId}", testComment.getId()))
                .andDo(print())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    @DisplayName("댓글 삭제 - 존재하지 않는 댓글")
    @WithMockCustomUser(username = "testuser")
    void deleteComment_notFound() throws Exception {
        mockMvc.perform(delete("/api/comments/{commentId}", 999999))
                .andDo(print())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));
    }
}

