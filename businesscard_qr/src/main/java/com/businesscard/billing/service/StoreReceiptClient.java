package com.businesscard.billing.service;

import com.businesscard.billing.entity.Store;

/** 스토어 한 곳과 실제로 통신하는 구현. {@link RoutingStoreReceiptVerifier} 가 골라 쓴다. */
public interface StoreReceiptClient {

    /** 이 구현이 담당하는 스토어. */
    Store store();

    /** 자격증명이 갖춰져 실제로 검증할 수 있는 상태인지. 아니면 라우터가 503 을 던진다. */
    boolean isConfigured();

    VerifiedPurchase verify(String productId, String purchaseToken);
}
