package com.doll.gacha.review;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.common.dto.PageResponse;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.review.dto.ReviewCreateDTO;
import com.doll.gacha.review.dto.ReviewDTO;
import com.doll.gacha.review.dto.ReviewStatsDTO;
import com.doll.gacha.review.dto.ReviewUpdateDTO;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    /**
     * 특정 가게의 리뷰 목록 조회 - 페이징
     *
     * @param dollShopId 가게 ID
     * @param pageable 페이징 정보 (Spring이 자동 변환)
     *                 - page: 페이지 번호 (0부터 시작, 기본값: 0)
     *                 - size: 페이지 크기 (기본값: 10)
     *                 - sort: 정렬 (예: createdAt,desc)
     * @return 페이징된 리뷰 목록
     */
    @GetMapping("/doll-shop/{dollShopId}")
    public ResponseEntity<ApiResponse<PageResponse<ReviewDTO>>> getShopReviews(
            @PathVariable Long dollShopId,
            Pageable pageable) {
        Page<ReviewDTO> reviews = reviewService.getReviewsByDollShopIdPaged(dollShopId, pageable);
        return ResponseEntity.ok(ApiResponse.success("리뷰 목록 조회 성공", PageResponse.from(reviews)));
    }

    /**
     * 특정 가게의 리뷰 통계 조회
     * @param dollShopId 가게 ID
     * @return 리뷰 통계 (평균 별점, 기계 힘, 비용 등)
     */
    @GetMapping("/doll-shop/{dollShopId}/stats")
    public ResponseEntity<ApiResponse<ReviewStatsDTO>> getShopReviewStats(@PathVariable Long dollShopId) {
        ReviewStatsDTO stats = reviewService.getReviewStats(dollShopId);
        return ResponseEntity.ok(ApiResponse.success("리뷰 통계 조회 성공", stats));
    }

    /**
     * 리뷰 작성 (인증 필요)
     * SecurityConfig에서 POST /api/reviews/** 에 대해 authenticated() 설정됨
     *
     * @param createDTO 리뷰 작성 정보
     * @param userAccount 현재 로그인한 사용자 정보 (Spring Security가 자동 주입)
     * @return 생성된 리뷰 정보
     */
    @PostMapping
    public ResponseEntity<ApiResponse<ReviewDTO>> createReview(
            @Valid @RequestBody ReviewCreateDTO createDTO,
            @AuthenticationPrincipal CustomUserAccount userAccount) {
        String username = userAccount.getUsername();
        ReviewDTO createdReview = reviewService.createReview(username, createDTO, LocalDateTime.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("리뷰가 작성되었습니다", createdReview));
    }

    /**
     * 리뷰 수정 (인증 필요)
     */
    @PutMapping("/{reviewId}")
    public ResponseEntity<ApiResponse<ReviewDTO>> updateReview(
            @PathVariable Long reviewId,
            @Valid @RequestBody ReviewUpdateDTO updateDTO,
            @AuthenticationPrincipal CustomUserAccount userAccount) {
        String username = userAccount.getUsername();
        ReviewDTO updatedReview = reviewService.updateReview(reviewId, username, updateDTO);
        return ResponseEntity.ok(ApiResponse.success("리뷰가 수정되었습니다", updatedReview));
    }

    /**
     * 리뷰 삭제 (인증 필요)
     * SecurityConfig에서 DELETE /api/reviews/** 에 대해 authenticated() 설정됨
     *
     * @param reviewId 삭제할 리뷰 ID
     * @param userAccount 현재 로그인한 사용자 정보 (Spring Security가 자동 주입)
     * @return 삭제 성공 응답
     */
    @DeleteMapping("/{reviewId}")
    public ResponseEntity<ApiResponse<Void>> deleteReview(
            @PathVariable Long reviewId,
            @AuthenticationPrincipal CustomUserAccount userAccount) {
        String username = userAccount.getUsername();
        reviewService.deleteReview(reviewId, username);
        return ResponseEntity.ok(ApiResponse.success("리뷰가 삭제되었습니다"));
    }
}
