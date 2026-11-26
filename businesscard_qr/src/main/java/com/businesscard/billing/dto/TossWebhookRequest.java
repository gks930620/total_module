package com.businesscard.billing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 토스 웹훅 본문(PAYMENT_STATUS_CHANGED) 중 우리가 읽는 부분.
 *
 * <p><b>이 본문은 "무언가 바뀌었다"는 신호로만 쓴다.</b> 웹훅 주소는 누구나 부를 수 있어서,
 * 본문의 상태값을 믿고 권한을 주거나 거두면 위조 요청 하나로 조작된다. 실제 상태는 토스 API 로 다시 묻는다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TossWebhookRequest {

    public static final String PAYMENT_STATUS_CHANGED = "PAYMENT_STATUS_CHANGED";

    private String eventType;

    private Payment data;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Payment {
        private String paymentKey;
        private String orderId;
        private String status;
    }
}
