package com.doll.gacha.review.dto;

import com.doll.gacha.dollshop.DollShop;
import com.doll.gacha.jwt.entity.UserEntity;
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
public class ReviewCreateDTO {

    @NotNull(message = "가게 ID는 필수입니다")
    private Long dollShopId;

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
     * DTO -> Entity 변환
     */
    public ReviewEntity toEntity(UserEntity user, DollShop dollShop) {
        return toEntity(user, dollShop, null);
    }

    public ReviewEntity toEntity(UserEntity user, DollShop dollShop, java.time.LocalDateTime createdAt) {
        return ReviewEntity.builder()
                .user(user)
                .dollShop(dollShop)
                .content(this.content)
                .rating(this.rating)
                .machineStrength(this.machineStrength)
                .largeDollCost(this.largeDollCost)
                .mediumDollCost(this.mediumDollCost)
                .smallDollCost(this.smallDollCost)
                .createdAt(createdAt)
                .updatedAt(createdAt)
                .build();
    }
}
