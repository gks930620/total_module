package com.doll.gacha.review.dto;

import com.doll.gacha.review.ReviewEntity;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewDTO {
    private Long id;
    private Long userId;
    private String username;
    private String nickname;
    private Long dollShopId;
    private String content;
    private Integer rating;
    private Integer machineStrength;
    private Integer largeDollCost;
    private Integer mediumDollCost;
    private Integer smallDollCost;
    private List<String> imageUrls; // 이미지 URL 리스트
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ReviewDTO from(ReviewEntity entity) {
        return from(entity, List.of());
    }

    public static ReviewDTO from(ReviewEntity entity, List<String> imageUrls) {
        if (entity == null) {
            return null;
        }
        return ReviewDTO.builder()
                .id(entity.getId())
                .userId(entity.getUser().getId())
                .username(entity.getUser().getUsername())
                .nickname(entity.getUser().getNickname())
                .dollShopId(entity.getDollShop().getId())
                .content(entity.getContent())
                .rating(entity.getRating())
                .machineStrength(entity.getMachineStrength())
                .largeDollCost(entity.getLargeDollCost())
                .mediumDollCost(entity.getMediumDollCost())
                .smallDollCost(entity.getSmallDollCost())
                .imageUrls(imageUrls)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

