package com.businesscard.billing.dto;

import com.businesscard.billing.config.LifetimePass;
import com.businesscard.billing.entity.WebOrderEntity;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

/**
 * 방금 만든 주문 — 웹앱이 이 값으로 토스 결제창을 연다.
 *
 * <p>{@code client_key} 는 공개 키다(토스가 브라우저에서 쓰라고 만든 키). 시크릿 키는 여기 절대 싣지 않는다.
 */
@Getter
@Builder
public class WebOrderResponse {

    @JsonProperty("order_id")
    private final String orderId;

    @JsonProperty("product_id")
    private final String productId;

    private final long amount;

    private final String currency;

    @JsonProperty("order_name")
    private final String orderName;

    @JsonProperty("client_key")
    private final String clientKey;

    public static WebOrderResponse from(WebOrderEntity order, String clientKey) {
        return WebOrderResponse.builder()
                .orderId(order.getOrderId())
                .productId(order.getProductId())
                .amount(order.getAmount())
                .currency(LifetimePass.CURRENCY)
                .orderName(LifetimePass.ORDER_NAME)
                .clientKey(clientKey)
                .build();
    }
}
