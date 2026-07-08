package com.doll.gacha.review.dto;

import com.doll.gacha.review.ReviewEntity;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewUpdateDTO {

    @NotBlank(message = "리뷰 내용은 필수입니다")
    private String content;

    @NotNull(message = "별점은 필수입니다")
    @Min(value = 1, message = "별점은 1점 이상이어야 합니다")
    @Max(value = 5, message = "별점은 5점 이하여야 합니다")
    private Integer rating;

    @NotNull(message = "기계 힘 평가는 필수입니다")
    @Min(value = 1, message = "기계 힘은 1점 이상이어야 합니다")
    @Max(value = 5, message = "기계 힘은 5점 이하여야 합니다")
    private Integer machineStrength;

    private Integer largeDollCost;
    private Integer mediumDollCost;
    private Integer smallDollCost;

    /**
     * Entity 업데이트
     */
    public void updateEntity(ReviewEntity review) {
        review.update(this.content, this.rating, this.machineStrength,
                      this.largeDollCost, this.mediumDollCost, this.smallDollCost);
    }
}

