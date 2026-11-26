package com.businesscard.billing.service;

import com.businesscard.billing.config.LifetimePass;
import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.businesscard.billing.entity.SubscriptionStatus;
import com.businesscard.billing.entity.WebOrderStatus;
import com.businesscard.billing.repository.SubscriptionRepository;
import com.businesscard.billing.repository.WebOrderRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "이 사용자가 지금 프로인가"만 답하는 서비스.
 *
 * <p>명함이나 결제 흐름을 모른다. 그래서 명함 도메인이 이걸 가져다 써도 순환 의존이 생기지 않는다
 * ({@code BusinessCardService → EntitlementService}, {@code BillingService → EntitlementService}).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EntitlementService {

    /** 만료 전이면 프로를 주는 상태들 — 갱신을 껐어도(CANCELED) 남은 기간은 프로다. */
    private static final List<SubscriptionStatus> ACCESS_GRANTING_STATUSES =
            List.of(SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED);

    private final SubscriptionRepository subscriptionRepository;
    private final WebOrderRepository webOrderRepository;

    /** 평생 이용권(웹 결제)을 가졌는지. 환불(CANCELED)되면 false 로 돌아간다. */
    public boolean hasLifetime(String userId) {
        return webOrderRepository.existsByUserIdAndProductIdAndStatus(
                userId, LifetimePass.PRODUCT_ID, WebOrderStatus.PAID);
    }

    /** 지금 유효한 구독 중 가장 늦게 끝나는 것. 없으면 무료 사용자다. */
    public Optional<SubscriptionEntity> activeSubscription(String userId) {
        return activeSubscription(userId, LocalDateTime.now());
    }

    /** 시각을 주입받는 형태 — 시간 의존 로직을 결정적으로 테스트하기 위해서다(코드컨벤션 §6). */
    public Optional<SubscriptionEntity> activeSubscription(String userId, LocalDateTime now) {
        return subscriptionRepository
                .findFirstByUserIdAndStatusInAndExpiresAtAfterOrderByExpiresAtDesc(
                        userId, ACCESS_GRANTING_STATUSES, now);
    }

    /** 평생 이용권이 있거나, 유효한 스토어 구독이 있으면 프로다. */
    public boolean isPro(String userId) {
        return hasLifetime(userId) || activeSubscription(userId).isPresent();
    }

    /** 영수증으로 기존 구독을 찾는다 — 계정 간 도용 검사에 쓴다. */
    public Optional<SubscriptionEntity> findByReceipt(Store store, String purchaseToken) {
        return subscriptionRepository.findByStoreAndPurchaseToken(store, purchaseToken);
    }
}
