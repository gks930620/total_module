package com.businesscard.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "app_users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserEntity {

    @Id
    private String id;

    @Column(nullable = false, length = 30)
    private String provider;

    @Column(length = 100)
    private String email;

    @Column(length = 100)
    private String nickname;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public UserEntity(String id, String provider, String email, String nickname) {
        this.id = id;
        this.provider = provider;
        this.email = email;
        this.nickname = nickname;
    }

    public void updateProfile(String provider, String email, String nickname) {
        if (provider != null && !provider.isBlank()) {
            this.provider = provider;
        }
        this.email = email;
        this.nickname = nickname;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (provider == null || provider.isBlank()) {
            provider = "kakao";
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
