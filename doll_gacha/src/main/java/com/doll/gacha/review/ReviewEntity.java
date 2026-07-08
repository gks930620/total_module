package com.doll.gacha.review;

import com.doll.gacha.dollshop.DollShop;
import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "reviews")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 리뷰 작성자 (N:1 - 여러 리뷰는 한 사용자에게 속함)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    // 리뷰 대상 매장 (N:1 - 여러 리뷰는 한 매장에 속함)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doll_shop_id", nullable = false)
    private DollShop dollShop;

    // 리뷰 내용
    @Column(nullable = false, length = 2000)
    private String content;

    // 전체 별점 (1~5)
    @Column(nullable = false)
    private Integer rating;

    // 기계 힘 평가 (1~5)
    @Column(nullable = false)
    private Integer machineStrength;

    // 인형 크기별 지출 금액
    @Column
    private Integer largeDollCost;  // 대형 인형 1개당 지출

    @Column
    private Integer mediumDollCost; // 중형 인형 1개당 지출

    @Column
    private Integer smallDollCost;  // 소형 인형 1개당 지출


    // 삭제 여부
    @Column(nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ===== 비즈니스 메서드 =====

    /**
     * 리뷰 소프트 삭제
     */
    public void softDelete() {
        if (this.isDeleted) {
            throw com.doll.gacha.common.exception.DuplicateResourceException.alreadyDeleted("리뷰");
        }
        this.isDeleted = true;
    }

    /**
     * 작성자 확인
     */
    public boolean isWrittenBy(String username) {
        return this.user != null && this.user.getUsername().equals(username);
    }

    /**
     * 리뷰 정보 업데이트
     */
    public void update(String content, Integer rating, Integer machineStrength,
                       Integer largeDollCost, Integer mediumDollCost, Integer smallDollCost) {
        this.content = content;
        this.rating = rating;
        this.machineStrength = machineStrength;
        this.largeDollCost = largeDollCost;
        this.mediumDollCost = mediumDollCost;
        this.smallDollCost = smallDollCost;
        // updatedAt is handled by @PreUpdate or manually if we want
    }
}
