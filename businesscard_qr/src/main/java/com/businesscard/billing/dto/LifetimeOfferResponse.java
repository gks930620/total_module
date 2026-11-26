package com.businesscard.billing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

/**
 * 프로 화면이 보여줄 평생 이용권 정보. 가격은 서버가 정한다 — 화면에 숫자를 박아 두지 않는다.
 */
@Getter
@Builder
public class LifetimeOfferResponse {

    @JsonProperty("product_id")
    private final String productId;

    /** 원(KRW). */
    private final long amount;

    private final String currency;

    /** false 면 결제 키가 아직 없다 — 화면은 구매 버튼 대신 "결제 준비 중"을 보여준다. */
    private final boolean available;

    /** 무료 플랜의 명함 한도 — 로그인 전 첫 화면의 요금 안내에 쓴다. */
    @JsonProperty("free_card_limit")
    private final int freeCardLimit;
}
