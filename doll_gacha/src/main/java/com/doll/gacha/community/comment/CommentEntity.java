package com.doll.gacha.community.comment;

import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "comment")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 댓글이 달린 게시글 (N:1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "community_id", nullable = false)
    private CommunityEntity community;

    // 작성자 (N:1)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

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
     * 댓글 수정
     */
    public void update(String content) {
        this.content = content;
    }

    /**
     * 댓글 소프트 삭제
     */
    public void softDelete() {
        if (this.isDeleted) {
            throw com.doll.gacha.common.exception.DuplicateResourceException.alreadyDeleted("댓글");
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

