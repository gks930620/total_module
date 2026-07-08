package com.doll.gacha.community;

import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "community")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 작성자 (N:1 - 여러 게시글은 한 사용자에게 속함)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    @Builder.Default
    private Integer viewCount = 0;

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
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ===== 비즈니스 메서드 =====

    /**
     * 조회수 증가
     */
    public void incrementViewCount() {
        this.viewCount++;
    }

    /**
     * 게시글 수정
     */
    public void update(String title, String content) {
        this.title = title;
        this.content = content;
    }

    /**
     * 게시글 소프트 삭제
     */
    public void softDelete() {
        if (this.isDeleted) {
            throw com.doll.gacha.common.exception.DuplicateResourceException.alreadyDeleted("게시글");
        }
        this.isDeleted = true;
    }

    /**
     * 작성자 확인
     */
    public boolean isWrittenBy(String username) {
        return this.user != null && this.user.getUsername().equals(username);
    }
}

