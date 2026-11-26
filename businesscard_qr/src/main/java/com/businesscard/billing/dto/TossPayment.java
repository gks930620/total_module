package com.businesscard.billing.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

/**
 * 토스페이먼츠 Payment 객체 중 우리가 쓰는 부분. 토스 응답을 우리 말로 옮긴 것이다.
 *
 * <p>상태값(토스): READY, IN_PROGRESS, WAITING_FOR_DEPOSIT, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED.
 */
@Getter
@Builder
public class TossPayment {

    private final String paymentKey;
    private final String orderId;
    private final String status;
    private final long totalAmount;

    /** "카드", "간편결제" 등 — 토스가 한국어 이름으로 준다. */
    private final String method;

    /** 승인 시각(서버 시간대로 옮긴 값). 승인 전이면 null. */
    private final LocalDateTime approvedAt;

    public boolean isDone() {
        return "DONE".equals(status);
    }

    /**
     * 전액 취소만 본다. 부분 취소(PARTIAL_CANCELED)는 운영자가 일부만 돌려준 것이라
     * 이용권은 그대로 둔다 — 평생 이용권은 나눌 수 없는 상품이다.
     */
    public boolean isFullyCanceled() {
        return "CANCELED".equals(status);
    }
}
