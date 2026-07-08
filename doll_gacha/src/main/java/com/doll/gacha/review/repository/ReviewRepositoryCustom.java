package com.doll.gacha.review.repository;

import com.doll.gacha.review.dto.ReviewDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ReviewRepositoryCustom {

    /**
     * 특정 가게의 리뷰 목록 조회 - 페이징 (N+1 해결, 파일 정보 포함)
     */
    Page<ReviewDTO> findReviewsWithFilesByDollShopId(Long dollShopId, Pageable pageable);
}

