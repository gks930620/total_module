package com.businesscard.billing.service;

import lombok.Getter;

/**
 * 토스가 오류 응답(4xx)을 준 경우. 토스의 오류 코드와, 사용자에게 보여주라고 만든 안내 문장을 그대로 담는다.
 *
 * <p>API 응답으로 바로 나가는 예외가 아니다 — {@code WebCheckoutService} 가 코드를 보고
 * "복구할 수 있는가(이미 처리됨)" / "거절인가" 를 판단해 바꿔 던진다.
 */
@Getter
public class TossPaymentsException extends RuntimeException {

    private final int httpStatus;
    private final String code;

    public TossPaymentsException(int httpStatus, String code, String message) {
        super(message);
        this.httpStatus = httpStatus;
        this.code = code;
    }

    /** 같은 결제를 이미 승인했다 — 우리가 그 응답을 놓친 경우다. 조회해서 복구한다. */
    public boolean isAlreadyProcessed() {
        return "ALREADY_PROCESSED_PAYMENT".equals(code);
    }

    /** 같은 승인 요청이 지금 처리 중이다(동시에 두 번 눌림) — 잠시 뒤 다시 하면 된다. */
    public boolean isStillProcessing() {
        return "ALREADY_PROCESSING_REQUEST".equals(code);
    }
}
