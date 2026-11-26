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
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 웹 결제(토스페이먼츠) 주문 1건. 설계 {@code 설계/웹결제_설계.md} §2.
 *
 * <p><b>금액은 주문을 만들 때 서버가 정해 여기 고정한다.</b> 승인 요청 때 브라우저가 들고 온 금액을
 * 이 값과 비교한다 — 화면이나 주소의 숫자를 고쳐도 결제 금액은 바뀌지 않는다.
 *
 * <p>안전장치는 DB 에도 있다: {@code order_id}·{@code payment_key} 가 UNIQUE 라
 * 결제 한 건이 두 주문(두 계정)에 붙을 수 없다.
 *
 * <p>회원 탈퇴해도 지우지 않는다 — 전자상거래법상 대금결제 기록은 5년 보관이다
 * (구독 기록 {@link SubscriptionEntity} 와 같다).
 */
@Entity
@Table(
        name = "web_orders",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_web_orders_order_id", columnNames = "order_id"),
                @UniqueConstraint(name = "uk_web_orders_payment_key", columnNames = "payment_key")
        },
        indexes = @Index(name = "idx_web_orders_user_id", columnList = "user_id")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WebOrderEntity {

    private static final int METHOD_MAX_LENGTH = 30;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 토스에 넘기는 주문번호. 밖으로 나가는 값이라 순번(id)이 아니라 추측할 수 없는 값이다(코드컨벤션 §4-1).
     * 토스 규칙: 6~64자, 영문·숫자·{@code -}·{@code _}.
     */
    @Column(name = "order_id", nullable = false, length = 64)
    private String orderId;

    /** {@code app_users.id} — 인증 토큰 주체에서만 채운다. */
    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Column(name = "product_id", nullable = false, length = 100)
    private String productId;

    /** 원(KRW). */
    @Column(nullable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WebOrderStatus status;

    /** 토스 결제 키. 승인된 뒤에만 채워진다. */
    @Column(name = "payment_key", length = 200)
    private String paymentKey;

    /**
     * 토스가 알려준 결제수단 이름("카드", "간편결제" 등) — 문의 응대용.
     * 카드번호 같은 결제수단 정보는 받지도 저장하지도 않는다.
     */
    @Column(length = METHOD_MAX_LENGTH)
    private String method;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "canceled_at")
    private LocalDateTime canceledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private WebOrderEntity(String orderId, String userId, String productId, long amount) {
        this.orderId = orderId;
        this.userId = userId;
        this.productId = productId;
        this.amount = amount;
        this.status = WebOrderStatus.PENDING;
    }

    /** 결제 전 주문. 주문번호는 여기서 만든다 — 클라이언트가 정하게 두지 않는다. */
    public static WebOrderEntity pending(String userId, String productId, long amount) {
        // "bq_" + 하이픈 뺀 UUID 32자 = 35자
        return new WebOrderEntity("bq_" + UUID.randomUUID().toString().replace("-", ""), userId, productId, amount);
    }

    public boolean isOwnedBy(String candidateUserId) {
        return userId.equals(candidateUserId);
    }

    public boolean isPending() {
        return status == WebOrderStatus.PENDING;
    }

    public boolean isPaid() {
        return status == WebOrderStatus.PAID;
    }

    /** 같은 결제로 이미 승인된 주문인지 — 승인 요청이 다시 와도 한 번만 처리하기 위해(멱등). */
    public boolean isPaidWith(String candidatePaymentKey) {
        return isPaid() && paymentKey != null && paymentKey.equals(candidatePaymentKey);
    }

    public void markPaid(String paymentKey, String method, LocalDateTime approvedAt) {
        this.status = WebOrderStatus.PAID;
        this.paymentKey = paymentKey;
        // 토스가 승인한 뒤에 기록이 실패하면 "돈은 나갔는데 권한이 없는" 사고가 된다.
        // 문의 응대용 값 하나 때문에 그렇게 되지 않도록 길이를 넘으면 잘라 둔다.
        this.method = method == null || method.length() <= METHOD_MAX_LENGTH
                ? method
                : method.substring(0, METHOD_MAX_LENGTH);
        this.approvedAt = approvedAt;
    }

    public void markCanceled(LocalDateTime canceledAt) {
        this.status = WebOrderStatus.CANCELED;
        this.canceledAt = canceledAt;
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
