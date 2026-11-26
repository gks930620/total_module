package com.businesscard.billing.service;

import com.businesscard.billing.dto.PurchaseVerifyRequest;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.businesscard.billing.repository.SubscriptionRepository;
import com.businesscard.common.exception.DuplicateResourceException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 검증이 끝난 구매를 DB 에 쓰는 부분만 떼어낸 빈.
 *
 * <p><b>왜 별도 빈인가:</b> {@code @Transactional} 은 스프링 프록시로 걸리므로 같은 객체 안에서
 * {@code this.save(...)} 로 부르면 <b>트랜잭션이 아예 적용되지 않는다.</b>
 * {@code BillingService} 는 스토어 HTTP 호출 때문에 트랜잭션을 열면 안 되고,
 * 쓰기는 짧은 트랜잭션이어야 해서(코드컨벤션 §1) 이렇게 나눴다.
 */
@Service
@RequiredArgsConstructor
public class SubscriptionRegistrar {

    private final SubscriptionRepository subscriptionRepository;

    /**
     * 같은 영수증으로 다시 오면 새 행을 만들지 않고 갱신한다 —
     * 앱이 네트워크 실패로 재시도해도 구독이 중복되지 않아야 하기 때문(멱등).
     */
    @Transactional
    public void register(String userId, PurchaseVerifyRequest request, VerifiedPurchase verified) {
        Optional<SubscriptionEntity> existing = subscriptionRepository
                .findByStoreAndPurchaseToken(request.getStore(), request.getPurchaseToken());

        if (existing.isPresent()) {
            SubscriptionEntity subscription = existing.get();
            // 검증하는 사이에 다른 계정이 선점했을 수 있다 — 저장 직전에 한 번 더 확인한다.
            if (!subscription.isOwnedBy(userId)) {
                throw DuplicateResourceException.alreadyExists("이미 다른 계정에 등록된 결제입니다.");
            }
            subscription.syncFromStore(
                    verified.getProductId(),
                    verified.getStatus(),
                    verified.getExpiresAt(),
                    verified.isAutoRenewing());
            subscriptionRepository.save(subscription);
            return;
        }

        subscriptionRepository.save(SubscriptionEntity.builder()
                .userId(userId)
                .store(request.getStore())
                .productId(verified.getProductId())
                .purchaseToken(request.getPurchaseToken())
                .status(verified.getStatus())
                .expiresAt(verified.getExpiresAt())
                .autoRenewing(verified.isAutoRenewing())
                .build());
    }
}
