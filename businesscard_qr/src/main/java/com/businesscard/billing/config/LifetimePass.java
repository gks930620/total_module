package com.businesscard.billing.config;

/**
 * 프로 평생 이용권 — 한 번 결제하면 영구히 프로. 설계 {@code 설계/웹결제_설계.md} §1.
 *
 * <p>가격만 환경변수로 바꾼다({@code APP_BILLING_LIFETIME_PRICE}). 상품 ID 는 DB 에 남는 식별자라 고정한다.
 */
public final class LifetimePass {

    public static final String PRODUCT_ID = "pro_lifetime";

    /** 토스 결제창·영수증·카드 명세서에 찍히는 이름. 토스 규칙: 100자 이하. */
    public static final String ORDER_NAME = "명함QR 프로 평생 이용권";

    /** 국내 PG(토스) 원화 결제만 한다. 해외 카드는 토스와 별도 계약이 필요하다. */
    public static final String CURRENCY = "KRW";

    private LifetimePass() {
    }
}
