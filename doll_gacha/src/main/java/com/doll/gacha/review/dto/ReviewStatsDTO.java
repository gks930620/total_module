package com.doll.gacha.review.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewStatsDTO {
    private Long totalReviews;          // 총 리뷰 개수
    private Double avgRating;           // 평균 별점
    private Double avgMachineStrength;  // 평균 기계 힘
    private Double avgLargeDollCost;    // 평균 대형 인형 비용
    private Double avgMediumDollCost;   // 평균 중형 인형 비용
    private Double avgSmallDollCost;    // 평균 소형 인형 비용

    /**
     * 리뷰가 없을 때 기본값 반환
     */
    public static ReviewStatsDTO empty() {
        return ReviewStatsDTO.builder()
                .totalReviews(0L)
                .avgRating(0.0)
                .avgMachineStrength(0.0)
                .avgLargeDollCost(0.0)
                .avgMediumDollCost(0.0)
                .avgSmallDollCost(0.0)
                .build();
    }
}

