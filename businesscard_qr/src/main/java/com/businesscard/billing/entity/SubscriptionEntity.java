package com.businesscard.billing.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 스토어 구독 1건. 설계: {@code 설계/인앱결제_설계.md} §2.
 *
 * <p>{@code UNIQUE(store, purchase_token)} 이 이 표의 핵심 안전장치다 —
 * 같은 영수증을 여러 계정에 붙여 프로를 복제하는 것을 DB 레벨에서 막는다.
 */
@Entity
@Table(
        name = "subscriptions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_subscriptions_store_token",
                columnNames = {"store", "purchase_token"}
        ),
        indexes = @Index(name = "idx_subscriptions_user_id", columnList = "user_id")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SubscriptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** {@code app_users.id} — 인증 토큰 주체에서만 채운다. 클라이언트가 보낸 값을 쓰지 않는다. */
    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Store store;

    @Column(name = "product_id", nullable = false, length = 100)
    private String productId;

    /** Google 은 purchaseToken, Apple 은 originalTransactionId. */
    @Column(name = "purchase_token", nullable = false, length = 512)
    private String purchaseToken;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubscriptionStatus status;

    /** 구독 만료 시각. 스토어가 알려주지 않으면 null 이고, 그때는 프로로 치지 않는다. */
    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "auto_renewing", nullable = false)
    private boolean autoRenewing;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    public SubscriptionEntity(
            String userId,
            Store store,
            String productId,
            String purchaseToken,
            SubscriptionStatus status,
            LocalDateTime expiresAt,
            boolean autoRenewing
    ) {
        this.userId = userId;
        this.store = store;
        this.productId = productId;
        this.purchaseToken = purchaseToken;
        this.status = status;
        this.expiresAt = expiresAt;
        this.autoRenewing = autoRenewing;
    }

    /** 스토어 재조회 결과로 갱신한다. 소유자(userId)와 영수증(purchaseToken)은 바뀌지 않는다. */
    public void syncFromStore(
            String productId,
            SubscriptionStatus status,
            LocalDateTime expiresAt,
            boolean autoRenewing
    ) {
        this.productId = productId;
        this.status = status;
        this.expiresAt = expiresAt;
        this.autoRenewing = autoRenewing;
    }

    /**
     * 지금 이 구독이 프로 권한을 주는지.
     *
     * <p>상태와 만료 시각을 <b>둘 다</b> 본다. 갱신을 끈(CANCELED) 구독도 남은 기간에는 프로이고,
     * ACTIVE 로 남아 있어도 만료 시각이 지났으면 프로가 아니다.
     */
    public boolean isEffectiveAt(LocalDateTime now) {
        return status.grantsAccess() && expiresAt != null && expiresAt.isAfter(now);
    }

    public boolean isOwnedBy(String candidateUserId) {
        return userId.equals(candidateUserId);
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
