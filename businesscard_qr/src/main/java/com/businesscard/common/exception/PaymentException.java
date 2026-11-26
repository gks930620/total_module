package com.businesscard.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 웹 결제(토스페이먼츠) 오류. 웹앱은 문장이 아니라 {@code errorCode} 로 분기한다.
 *
 * <ul>
 *   <li>{@code PAYMENT_UNAVAILABLE} 503 — 결제 키가 없거나 토스가 응답하지 않는다. 우리 쪽 문제라 "잠시 후 다시".
 *       이때 절대 승인으로 치지 않는다.</li>
 *   <li>{@code PAYMENT_REJECTED} 400 — 토스·카드사가 거절했다. 토스의 안내 문장을 그대로 싣는다.</li>
 *   <li>{@code PAYMENT_AMOUNT_MISMATCH} 400 — 브라우저가 들고 온 금액이 주문 금액과 다르다(변조).</li>
 *   <li>{@code ALREADY_LIFETIME} 409 — 이미 평생 이용권이 있다.</li>
 *   <li>{@code ORDER_CLOSED} 409 — 이미 다른 결제로 끝났거나 환불된 주문이다.</li>
 * </ul>
 */
public class PaymentException extends BusinessException {

    private PaymentException(String message, HttpStatus status, String errorCode) {
        super(message, status, errorCode);
    }

    public static PaymentException unavailable(String message) {
        return new PaymentException(message, HttpStatus.SERVICE_UNAVAILABLE, "PAYMENT_UNAVAILABLE");
    }

    public static PaymentException rejected(String message) {
        return new PaymentException(message, HttpStatus.BAD_REQUEST, "PAYMENT_REJECTED");
    }

    public static PaymentException amountMismatch() {
        return new PaymentException("결제 금액이 주문 금액과 다릅니다.", HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_MISMATCH");
    }

    public static PaymentException alreadyLifetime() {
        return new PaymentException("이미 평생 이용권을 가지고 있습니다.", HttpStatus.CONFLICT, "ALREADY_LIFETIME");
    }

    public static PaymentException orderClosed() {
        return new PaymentException("이미 처리가 끝난 주문입니다.", HttpStatus.CONFLICT, "ORDER_CLOSED");
    }
}
