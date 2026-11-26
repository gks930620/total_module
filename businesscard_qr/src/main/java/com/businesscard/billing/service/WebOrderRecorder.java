package com.businesscard.billing.service;

import com.businesscard.billing.dto.TossPayment;
import com.businesscard.billing.entity.WebOrderEntity;
import com.businesscard.billing.entity.WebOrderStatus;
import com.businesscard.billing.repository.WebOrderRepository;
import com.businesscard.common.exception.EntityNotFoundException;
import com.businesscard.common.exception.PaymentException;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 토스가 확인해 준 결제를 주문에 기록하는 부분만 떼어낸 빈.
 *
 * <p><b>왜 별도 빈인가:</b> {@code SubscriptionRegistrar} 와 같은 이유다. {@code WebCheckoutService} 는
 * 토스 HTTP 호출 때문에 트랜잭션을 열면 안 되고, 쓰기는 짧은 트랜잭션이어야 한다(코드컨벤션 §1).
 * 같은 객체 안에서 {@code this.markPaid()} 로 부르면 {@code @Transactional} 이 걸리지 않는다.
 *
 * <p>쓰기 직전에 주문을 다시 읽어 상태를 확인한다 — 토스를 기다리는 사이 다른 요청(새로고침, 웹훅)이
 * 먼저 기록했을 수 있다.
 */
@Service
@RequiredArgsConstructor
public class WebOrderRecorder {

    private final WebOrderRepository webOrderRepository;

    /** 승인된 결제를 기록한다. 같은 결제로 이미 기록돼 있으면 그대로 둔다(멱등). */
    @Transactional
    public void markPaid(String orderId, TossPayment payment) {
        WebOrderEntity order = find(orderId);
        if (order.isPaidWith(payment.getPaymentKey())) {
            return;
        }
        if (!order.isPending()) {
            throw PaymentException.orderClosed();
        }
        LocalDateTime approvedAt = payment.getApprovedAt() != null ? payment.getApprovedAt() : LocalDateTime.now();
        order.markPaid(payment.getPaymentKey(), payment.getMethod(), approvedAt);
    }

    /** 전액 환불을 기록한다 — 이 순간부터 평생 이용권이 사라진다. */
    @Transactional
    public void markCanceled(String orderId) {
        WebOrderEntity order = find(orderId);
        if (order.getStatus() == WebOrderStatus.CANCELED) {
            return;
        }
        order.markCanceled(LocalDateTime.now());
    }

    private WebOrderEntity find(String orderId) {
        return webOrderRepository.findByOrderId(orderId)
                .orElseThrow(() -> EntityNotFoundException.of("주문", orderId));
    }
}
