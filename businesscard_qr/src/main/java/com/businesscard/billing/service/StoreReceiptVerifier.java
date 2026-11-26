package com.businesscard.billing.service;

import com.businesscard.billing.entity.Store;

/**
 * 영수증 검증 진입점. 스토어를 가리지 않는 하나의 창구다.
 *
 * <p>구현은 {@link RoutingStoreReceiptVerifier} 하나뿐이고, 실제 스토어별 호출은
 * {@link StoreReceiptClient} 들이 맡는다. 이렇게 나눠 둬야
 * 테스트에서 이 인터페이스만 목으로 갈아끼워 네트워크 없이 계약을 검증할 수 있다.
 */
public interface StoreReceiptVerifier {

    /**
     * @throws com.businesscard.common.exception.StoreUnavailableException 자격증명이 없거나 스토어가 응답하지 않을 때
     * @throws com.businesscard.common.exception.BusinessRuleException 스토어가 "그런 구매 없음"이라고 답할 때
     */
    VerifiedPurchase verify(Store store, String productId, String purchaseToken);
}
