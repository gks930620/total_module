package com.businesscard.billing.dto;

import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

/**
 * "지금 이 사용자가 프로인가, 명함을 몇 장 더 만들 수 있나". 설계 §3-1.
 *
 * <p>{@code card_limit} 이 <b>없으면(null) 무제한</b>이다. 숫자면 그 수까지만 만들 수 있다.
 * 프로가 아닐 때는 {@code store}/{@code product_id}/{@code expires_at} 이 통째로 빠진다.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EntitlementResponse {

    private final boolean pro;

    /** 평생 이용권(웹 결제, 한 번 결제하면 영구)으로 프로인지. true 면 만료일이 없다. */
    private final boolean lifetime;

    private final Store store;

    @JsonProperty("product_id")
    private final String productId;

    @JsonProperty("expires_at")
    private final LocalDateTime expiresAt;

    /** 지금 살아 있는(삭제되지 않은) 명함 수. */
    @JsonProperty("card_count")
    private final long cardCount;

    /** null 이면 무제한. */
    @JsonProperty("card_limit")
    private final Integer cardLimit;

    /** 무료 사용자 — 한도를 그대로 알려준다. */
    public static EntitlementResponse free(long cardCount, int cardLimit) {
        return EntitlementResponse.builder()
                .pro(false)
                .cardCount(cardCount)
                .cardLimit(cardLimit)
                .build();
    }

    /** 평생 이용권 사용자 — 만료일도 한도도 없다. */
    public static EntitlementResponse lifetime(String productId, long cardCount) {
        return EntitlementResponse.builder()
                .pro(true)
                .lifetime(true)
                .productId(productId)
                .cardCount(cardCount)
                .cardLimit(null)
                .build();
    }

    /** 프로 사용자 — 한도를 비워(null) 무제한임을 알린다. */
    public static EntitlementResponse pro(SubscriptionEntity subscription, long cardCount) {
        return EntitlementResponse.builder()
                .pro(true)
                .store(subscription.getStore())
                .productId(subscription.getProductId())
                .expiresAt(subscription.getExpiresAt())
                .cardCount(cardCount)
                .cardLimit(null)
                .build();
    }
}
