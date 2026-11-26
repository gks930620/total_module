package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.billing.config.LifetimePass;
import com.businesscard.billing.dto.EntitlementResponse;
import com.businesscard.billing.dto.PurchaseVerifyRequest;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.DuplicateResourceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 검증과 자격(entitlement) 조회. 설계: {@code 설계/인앱결제_설계.md}.
 *
 * <p>명함 수를 세야 해서 {@link BusinessCardRepository} 를 직접 읽는다(조회 전용).
 * {@code BusinessCardService} 를 부르지 않으므로 순환 의존은 없다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BillingService {

    private final BusinessCardRepository businessCardRepository;
    private final EntitlementService entitlementService;
    private final StoreReceiptVerifier storeReceiptVerifier;
    private final SubscriptionRegistrar subscriptionRegistrar;
    private final BillingProperties billingProperties;

    @Transactional(readOnly = true)
    public EntitlementResponse getEntitlement(String userId) {
        long cardCount = businessCardRepository.countByUserIdAndIsActiveTrue(userId);
        // 평생 이용권이 먼저다 — 구독이 함께 있어도 만료일 없는 쪽을 보여준다.
        if (entitlementService.hasLifetime(userId)) {
            return EntitlementResponse.lifetime(LifetimePass.PRODUCT_ID, cardCount);
        }
        return entitlementService.activeSubscription(userId)
                .map(subscription -> EntitlementResponse.pro(subscription, cardCount))
                .orElseGet(() -> EntitlementResponse.free(cardCount, billingProperties.getFreeCardLimit()));
    }

    /**
     * 스토어 영수증을 검증하고 구독을 기록한다.
     *
     * <p><b>여기서 트랜잭션을 열지 않는다.</b> 이 메서드의 대부분은 스토어 HTTP 호출인데,
     * 그 대기 동안 DB 커넥션을 붙잡으면 커넥션 풀이 마른다. HTTP 는 롤백도 안 되므로
     * 트랜잭션에 넣어도 원자성 이득이 없다(코드컨벤션 §1).
     * DB 쓰기는 {@link SubscriptionRegistrar} 의 짧은 트랜잭션 안에서만 한다.
     */
    public EntitlementResponse verifyPurchase(String userId, PurchaseVerifyRequest request) {
        if (!billingProperties.isProProduct(request.getProductId())) {
            throw new BusinessRuleException("알 수 없는 상품입니다: " + request.getProductId());
        }

        // 스토어에 물어보기 전에 남의 영수증인지부터 본다 — 도용이면 스토어 호출 자체가 낭비다.
        assertNotOwnedByAnotherUser(userId, request);

        // ── 여기부터 외부 호출 (트랜잭션 밖) ──
        VerifiedPurchase verified = storeReceiptVerifier.verify(
                request.getStore(), request.getProductId(), request.getPurchaseToken());

        subscriptionRegistrar.register(userId, request, verified);
        return getEntitlement(userId);
    }

    private void assertNotOwnedByAnotherUser(String userId, PurchaseVerifyRequest request) {
        entitlementService.findByReceipt(request.getStore(), request.getPurchaseToken())
                .filter(existing -> !existing.isOwnedBy(userId))
                .ifPresent(existing -> {
                    log.warn("영수증 도용 시도 차단: store={}, 요청자={}, 원소유자={}",
                            request.getStore(), userId, existing.getUserId());
                    throw DuplicateResourceException.alreadyExists("이미 다른 계정에 등록된 결제입니다.");
                });
    }
}
