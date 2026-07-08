package com.doll.gacha.review.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 리뷰와 파일 정보를 함께 담는 DTO
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewWithFilesDTO {
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    public void addImageUrl(String url) {
        if (this.imageUrls == null) {
            this.imageUrls = new ArrayList<>();
        }
        this.imageUrls.add(url);
    }
}

