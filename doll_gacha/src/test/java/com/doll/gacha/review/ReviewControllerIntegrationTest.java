package com.doll.gacha.review;

import com.doll.gacha.common.WithMockCustomUser;
import com.doll.gacha.dollshop.DollShop;
import com.doll.gacha.dollshop.repository.DollShopRepository;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import com.doll.gacha.review.dto.ReviewCreateDTO;
import com.doll.gacha.review.dto.ReviewUpdateDTO;
import com.doll.gacha.review.repository.ReviewRepository;
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

import java.time.LocalDateTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@DisplayName("Review Controller 통합 테스트")
class ReviewControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private DollShopRepository dollShopRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    private UserEntity testUser;
    private DollShop testDollShop;
    private ReviewEntity testReview;

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

        // 실제 존재하는 DollShop 사용 (ID: 857)
        testDollShop = dollShopRepository.findById(857L).orElse(null);

        // 테스트 리뷰 생성
        if (testDollShop != null) {
            testReview = ReviewEntity.builder()
                    .user(testUser)
                    .dollShop(testDollShop)
                    .content("테스트 리뷰입니다.")
                    .rating(4)
                    .machineStrength(3)
                    .largeDollCost(5000)
                    .mediumDollCost(3000)
                    .smallDollCost(1000)
                    .createdAt(LocalDateTime.now().minusDays(1))  // 하루 전 작성으로 설정 (중복 리뷰 방지)
                    .build();
            reviewRepository.save(testReview);
        }
    }

    @Test
    @DisplayName("특정 매장의 리뷰 목록 조회 (페이징)")
    void getReviewsByDollShop_success() throws Exception {
        // 실제 존재하는 매장 ID (예: 857)
        mockMvc.perform(get("/api/reviews/doll-shop/{dollShopId}", 857)
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.page").exists())
                .andExpect(jsonPath("$.data.totalElements").exists());
    }

    @Test
    @DisplayName("특정 매장의 리뷰 통계 조회")
    void getReviewStats_success() throws Exception {
        // 실제 존재하는 매장 ID
        mockMvc.perform(get("/api/reviews/doll-shop/{dollShopId}/stats", 857))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalReviews").exists())
                .andExpect(jsonPath("$.data.avgRating").exists())
                .andExpect(jsonPath("$.data.avgMachineStrength").exists())
                .andExpect(jsonPath("$.data.avgLargeDollCost").exists())
                .andExpect(jsonPath("$.data.avgMediumDollCost").exists())
                .andExpect(jsonPath("$.data.avgSmallDollCost").exists());
    }

    @Test
    @DisplayName("존재하지 않는 매장의 리뷰 조회")
    void getReviewsByDollShop_notFound() throws Exception {
        mockMvc.perform(get("/api/reviews/doll-shop/{dollShopId}", 999999)
                        .param("page", "0")
                        .param("size", "10"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isEmpty()); // 빈 배열 반환
    }

    @Test
    @DisplayName("리뷰 작성 - 로그인 필요")
    @WithMockCustomUser(username = "testuser")
    void createReview_success() throws Exception {
        // 다른 매장 ID 사용 (중복 방지)
        DollShop anotherShop = dollShopRepository.findById(858L).orElse(testDollShop);

        ReviewCreateDTO createDTO = ReviewCreateDTO.builder()
                .dollShopId(anotherShop != null ? anotherShop.getId() : 858L)
                .content("새 리뷰입니다. 좋아요!")
                .rating(5)
                .machineStrength(4)
                .largeDollCost(4000)
                .mediumDollCost(2500)
                .smallDollCost(1000)
                .build();

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value("새 리뷰입니다. 좋아요!"))
                .andExpect(jsonPath("$.data.rating").value(5));
    }

    @Test
    @DisplayName("리뷰 작성 - 인증 없이 요청 시 실패")
    void createReview_unauthorized() throws Exception {
        ReviewCreateDTO createDTO = ReviewCreateDTO.builder()
                .dollShopId(857L)
                .content("새 리뷰입니다.")
                .rating(5)
                .machineStrength(4)
                .build();

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("리뷰 작성 - 유효성 검증 실패 (별점 없음)")
    @WithMockCustomUser(username = "testuser")
    void createReview_validationFail() throws Exception {
        ReviewCreateDTO createDTO = ReviewCreateDTO.builder()
                .dollShopId(857L)
                .content("리뷰 내용")
                .rating(null)  // 필수값 누락
                .machineStrength(3)
                .build();

        mockMvc.perform(post("/api/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("리뷰 수정 - 작성자만 가능")
    @WithMockCustomUser(username = "testuser")
    void updateReview_success() throws Exception {
        if (testReview == null) return;

        ReviewUpdateDTO updateDTO = ReviewUpdateDTO.builder()
                .content("수정된 리뷰입니다.")
                .rating(3)
                .machineStrength(2)
                .largeDollCost(6000)
                .build();

        mockMvc.perform(put("/api/reviews/{reviewId}", testReview.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").value("수정된 리뷰입니다."))
                .andExpect(jsonPath("$.data.rating").value(3));
    }

    @Test
    @DisplayName("리뷰 수정 - 다른 사용자는 수정 불가")
    @WithMockCustomUser(username = "otheruser")
    void updateReview_forbidden() throws Exception {
        if (testReview == null) return;

        ReviewUpdateDTO updateDTO = ReviewUpdateDTO.builder()
                .content("수정된 리뷰입니다.")
                .rating(3)
                .machineStrength(2)
                .build();

        mockMvc.perform(put("/api/reviews/{reviewId}", testReview.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateDTO)))
                .andDo(print())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("리뷰 삭제 - 작성자만 가능")
    @WithMockCustomUser(username = "testuser")
    void deleteReview_success() throws Exception {
        if (testReview == null) return;

        mockMvc.perform(delete("/api/reviews/{reviewId}", testReview.getId()))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("리뷰 삭제 - 다른 사용자는 삭제 불가")
    @WithMockCustomUser(username = "otheruser")
    void deleteReview_forbidden() throws Exception {
        if (testReview == null) return;

        mockMvc.perform(delete("/api/reviews/{reviewId}", testReview.getId()))
                .andDo(print())
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("리뷰 삭제 - 존재하지 않는 리뷰")
    @WithMockCustomUser(username = "testuser")
    void deleteReview_notFound() throws Exception {
        mockMvc.perform(delete("/api/reviews/{reviewId}", 999999))
                .andDo(print())
                .andExpect(status().isNotFound());
    }
}

