package com.doll.gacha.review;

import com.doll.gacha.common.exception.AccessDeniedException;
import com.doll.gacha.common.exception.BusinessRuleException;
import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.dollshop.DollShop;
import com.doll.gacha.dollshop.repository.DollShopRepository;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import com.doll.gacha.review.dto.ReviewCreateDTO;
import com.doll.gacha.review.dto.ReviewDTO;
import com.doll.gacha.review.dto.ReviewStatsDTO;
import com.doll.gacha.review.dto.ReviewUpdateDTO;
import com.doll.gacha.review.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final DollShopRepository dollShopRepository;
    private final UserRepository userRepository;

    /**
     * 특정 가게의 리뷰 목록 조회 - 페이징 (N+1 해결)
     */
    public Page<ReviewDTO> getReviewsByDollShopIdPaged(Long dollShopId, Pageable pageable) {
        // Repository에서 직접 DTO로 조회 (파일 정보 포함, 카운트 쿼리 최적화)
        return reviewRepository.findReviewsWithFilesByDollShopId(dollShopId, pageable);
    }


    /**
     * 특정 가게의 리뷰 통계 조회
     */
    public ReviewStatsDTO getReviewStats(Long dollShopId) {
        ReviewStatsDTO stats = reviewRepository.findStatsByDollShopId(dollShopId);
        // 리뷰가 없는 경우 기본값 반환
        if (stats == null || stats.getTotalReviews() == null || stats.getTotalReviews() == 0) {
            return ReviewStatsDTO.empty();
        }
        return stats;
    }

    /**
     * 리뷰 작성
     */
    @Transactional
    public ReviewDTO createReview(String username, ReviewCreateDTO createDTO, LocalDateTime now) {
        // 사용자 조회
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> EntityNotFoundException.of("사용자", username));

        // 가게 조회
        DollShop dollShop = dollShopRepository.findById(createDTO.getDollShopId())
                .orElseThrow(() -> EntityNotFoundException.of("가게", createDTO.getDollShopId()));

        // 하루에 한 번만 작성 가능 체크
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        LocalDateTime endOfDay = now.toLocalDate().atTime(23, 59, 59);

        if (reviewRepository.existsByUser_IdAndDollShop_IdAndCreatedAtBetweenAndIsDeletedFalse(
                user.getId(), dollShop.getId(), startOfDay, endOfDay)) {
            throw new BusinessRuleException("해당 가게에 대한 리뷰는 하루에 한 번만 작성할 수 있습니다.");
        }

        // DTO -> Entity 변환 및 저장 (시간 주입)
        ReviewEntity savedReview = reviewRepository.save(createDTO.toEntity(user, dollShop, now));

        return ReviewDTO.from(savedReview);
    }

    /**
     * 리뷰 수정
     */
    @Transactional
    public ReviewDTO updateReview(Long reviewId, String username, ReviewUpdateDTO updateDTO) {
        ReviewEntity review = findReviewByIdAndValidateUser(reviewId, username, AccessDeniedException.forUpdate("리뷰"));

        if (review.getIsDeleted()) {
            throw new BusinessRuleException("삭제된 리뷰는 수정할 수 없습니다.");
        }

        updateDTO.updateEntity(review);
        return ReviewDTO.from(review);
    }

    /**
     * 리뷰 삭제 (Soft Delete)
     */
    @Transactional
    public void deleteReview(Long reviewId, String username) {
        ReviewEntity review = findReviewByIdAndValidateUser(reviewId, username, AccessDeniedException.forDelete("리뷰"));
        review.softDelete();
    }

    /**
     * 리뷰 조회 및 사용자 검증 공통 메서드
     * (수정/삭제에 따라 적절한 권한 오류 메시지를 전달받아 던진다)
     */
    private ReviewEntity findReviewByIdAndValidateUser(Long reviewId, String username, AccessDeniedException onDenied) {
        ReviewEntity review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> EntityNotFoundException.of("리뷰", reviewId));

        if (!review.isWrittenBy(username)) {
            throw onDenied;
        }

        return review;
    }
}
