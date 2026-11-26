package com.businesscard.billing.service;

import com.businesscard.billing.dto.TossPayment;

/**
 * 토스페이먼츠 API 창구. 테스트에서는 이 인터페이스를 목으로 바꿔 끼운다 —
 * 실제 호출은 키·네트워크에 의존해 테스트를 비결정적으로 만든다.
 *
 * <p>실패의 두 갈래:
 * <ul>
 *   <li>토스가 거절했다(카드 거절, 세션 만료 등) → {@link TossPaymentsException} — 토스의 코드·문장을 그대로 담는다.</li>
 *   <li>토스에 물어볼 수 없다(키 없음, 응답 없음, 5xx) →
 *       {@link com.businesscard.common.exception.PaymentException#unavailable} (503). 이때 절대 승인으로 치지 않는다.</li>
 * </ul>
 */
public interface TossPaymentsGateway {

    /** 비밀 키가 설정돼 있는지. 없으면 결제를 열지 않는다. */
    boolean isConfigured();

    /** 결제 승인 — 이 호출이 성공해야 돈이 빠져나간다. 결제창 인증 후 10분 안에 불러야 한다. */
    TossPayment confirm(String paymentKey, String orderId, long amount);

    /** 결제 조회 — 승인 응답을 놓쳤거나 웹훅을 받았을 때 "실제 상태"를 확인하는 데 쓴다. */
    TossPayment getPayment(String paymentKey);
}
