package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.billing.config.LifetimePass;
import com.businesscard.billing.dto.EntitlementResponse;
import com.businesscard.billing.dto.LifetimeOfferResponse;
import com.businesscard.billing.dto.TossPayment;
import com.businesscard.billing.dto.TossWebhookRequest;
import com.businesscard.billing.dto.WebOrderResponse;
import com.businesscard.billing.dto.WebPaymentConfirmRequest;
import com.businesscard.billing.entity.WebOrderEntity;
import com.businesscard.billing.repository.WebOrderRepository;
import com.businesscard.common.exception.EntityNotFoundException;
import com.businesscard.common.exception.PaymentException;
import java.util.Optional;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 웹 결제 — 프로 평생 이용권(한 번 결제하면 영구). 설계 {@code 설계/웹결제_설계.md}.
 *
 * <pre>
 * ① 주문 생성   서버가 금액을 정해 PENDING 주문으로 저장
 * ② 결제창      브라우저가 토스 결제창을 연다(여기까지는 돈이 빠지지 않는다)
 * ③ 승인        토스가 성공 주소로 돌려보내면 웹앱이 우리에게 알리고, 우리가 토스에 승인을 요청한다
 * ④ 환불        운영자가 토스 관리자 화면에서 취소하면 웹훅이 온다 → 권한 회수
 * </pre>
 *
 * <p><b>모든 검사는 ③의 토스 호출 전에 한다.</b> 승인 요청을 보내는 순간 돈이 빠져나가고,
 * 승인하지 않은 결제는 토스가 10분 뒤 자동으로 취소한다 — "안 보내면 안전"하다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebCheckoutService {

    private static final Pattern PAYMENT_KEY = Pattern.compile(WebPaymentConfirmRequest.PAYMENT_KEY_PATTERN);

    private final TossPaymentsGateway tossPaymentsGateway;
    private final WebOrderRepository webOrderRepository;
    private final WebOrderRecorder webOrderRecorder;
    private final EntitlementService entitlementService;
    private final BillingService billingService;
    private final BillingProperties billingProperties;

    public LifetimeOfferResponse getLifetimeOffer() {
        return LifetimeOfferResponse.builder()
                .productId(LifetimePass.PRODUCT_ID)
                .amount(billingProperties.getLifetimePrice())
                .currency(LifetimePass.CURRENCY)
                .available(tossPaymentsGateway.isConfigured())
                .freeCardLimit(billingProperties.getFreeCardLimit())
                .build();
    }

    /** ① 주문 생성. 금액은 여기서 서버 설정으로 정해 주문에 고정한다. */
    @Transactional
    public WebOrderResponse createLifetimeOrder(String userId) {
        if (!tossPaymentsGateway.isConfigured()) {
            throw PaymentException.unavailable("결제가 아직 준비되지 않았습니다.");
        }
        if (entitlementService.hasLifetime(userId)) {
            throw PaymentException.alreadyLifetime();
        }
        WebOrderEntity order = webOrderRepository.save(
                WebOrderEntity.pending(userId, LifetimePass.PRODUCT_ID, billingProperties.getLifetimePrice()));
        return WebOrderResponse.from(order, billingProperties.getTossClientKey());
    }

    /**
     * ③ 승인.
     *
     * <p><b>트랜잭션을 열지 않는다.</b> 대부분의 시간이 토스(→카드사) 응답 대기인데, 그동안 DB 커넥션을
     * 붙잡으면 커넥션 풀이 마른다(코드컨벤션 §1). 쓰기는 {@link WebOrderRecorder} 의 짧은 트랜잭션에서만 한다.
     */
    public EntitlementResponse confirm(String userId, String orderId, WebPaymentConfirmRequest request) {
        // 남의 주문이면 "없음" — 존재 여부도 알리지 않는다.
        WebOrderEntity order = webOrderRepository.findByOrderId(orderId)
                .filter(found -> found.isOwnedBy(userId))
                .orElseThrow(() -> EntityNotFoundException.of("주문", orderId));

        // 새로고침·뒤로가기로 같은 승인이 다시 왔다 — 토스에 다시 묻지 않는다.
        if (order.isPaidWith(request.getPaymentKey())) {
            return billingService.getEntitlement(userId);
        }
        if (!order.isPending()) {
            throw PaymentException.orderClosed();
        }
        if (order.getAmount() != request.getAmount()) {
            log.warn("결제 금액 불일치(변조 의심): orderId={}, 주문={}, 요청={}",
                    orderId, order.getAmount(), request.getAmount());
            throw PaymentException.amountMismatch();
        }
        // 다른 주문(다른 탭)으로 이미 평생 이용권이 생겼다. 승인하지 않으면 토스가 이 결제를 자동 취소한다.
        if (entitlementService.hasLifetime(userId)) {
            throw PaymentException.alreadyLifetime();
        }

        // ── 여기부터 외부 호출 (트랜잭션 밖) ──
        TossPayment payment = approve(order, request.getPaymentKey());
        assertSamePayment(order, payment);

        webOrderRecorder.markPaid(order.getOrderId(), payment);
        log.info("평생 이용권 결제 완료: orderId={}, userId={}", orderId, userId);
        return billingService.getEntitlement(userId);
    }

    /**
     * ④ 토스 웹훅. 본문은 "무언가 바뀌었다"는 신호로만 쓰고, 실제 상태는 토스에 직접 묻는다 —
     * 이 주소는 누구나 부를 수 있다.
     *
     * <p>토스에 물어볼 수 없으면 503 을 그대로 올려 보낸다 → 토스가 나중에 다시 보낸다(최대 7회).
     * 확인도 못 한 채 200 을 주면 환불 소식이 영영 사라진다.
     */
    public void handleWebhook(TossWebhookRequest event) {
        if (!TossWebhookRequest.PAYMENT_STATUS_CHANGED.equals(event.getEventType()) || event.getData() == null) {
            return;
        }
        String orderId = event.getData().getOrderId();
        Optional<WebOrderEntity> found = orderId == null ? Optional.empty() : webOrderRepository.findByOrderId(orderId);
        if (found.isEmpty()) {
            // 모르는 주문 — 토스에 묻지도 않는다(아무나 부를 수 있는 주소로 토스 API 를 두들기게 두지 않는다).
            log.info("웹훅: 모르는 주문이라 무시한다. orderId={}", orderId);
            return;
        }
        WebOrderEntity order = found.get();

        // 승인된 주문은 우리가 기록해 둔 결제 키로 묻는다 — 본문의 키를 믿지 않는다.
        String paymentKey = order.getPaymentKey() != null ? order.getPaymentKey() : event.getData().getPaymentKey();
        if (paymentKey == null || !PAYMENT_KEY.matcher(paymentKey).matches()) {
            return;
        }

        TossPayment payment;
        try {
            payment = tossPaymentsGateway.getPayment(paymentKey);
        } catch (TossPaymentsException e) {
            // 토스가 "그런 결제 없음" 등으로 답했다 — 다시 보내도 같은 답이니 받은 것으로 끝낸다.
            log.warn("웹훅: 토스 결제 조회 거절. orderId={}, code={}", orderId, e.getCode());
            return;
        }
        if (!order.getOrderId().equals(payment.getOrderId())) {
            log.warn("웹훅: 결제가 다른 주문의 것이다. 무시한다. orderId={}, toss.orderId={}", orderId, payment.getOrderId());
            return;
        }

        if (order.isPaid() && payment.isFullyCanceled()) {
            webOrderRecorder.markCanceled(orderId);
            log.info("평생 이용권 환불 반영: orderId={}, userId={}", orderId, order.getUserId());
        } else if (order.isPending() && payment.isDone() && payment.getTotalAmount() == order.getAmount()) {
            // 승인은 됐는데 성공 화면이 우리에게 알리지 못한 경우(창을 닫음 등) — 여기서 반영한다.
            webOrderRecorder.markPaid(orderId, payment);
            log.info("웹훅으로 결제 반영(승인 응답 유실 복구): orderId={}, userId={}", orderId, order.getUserId());
        }
    }

    private TossPayment approve(WebOrderEntity order, String paymentKey) {
        try {
            return tossPaymentsGateway.confirm(paymentKey, order.getOrderId(), order.getAmount());
        } catch (TossPaymentsException e) {
            if (e.isAlreadyProcessed()) {
                // 토스는 이미 승인했는데 우리가 그 응답을 놓쳤다(서버 재시작·타임아웃) — 실제 결제를 조회해 복구한다.
                return lookUp(paymentKey);
            }
            if (e.isStillProcessing()) {
                throw PaymentException.unavailable("결제를 처리하고 있습니다. 잠시 후 다시 확인해 주세요.");
            }
            log.info("결제 승인 거절: orderId={}, code={}", order.getOrderId(), e.getCode());
            throw PaymentException.rejected(e.getMessage());
        }
    }

    private TossPayment lookUp(String paymentKey) {
        try {
            return tossPaymentsGateway.getPayment(paymentKey);
        } catch (TossPaymentsException e) {
            throw PaymentException.rejected(e.getMessage());
        }
    }

    /** 토스가 승인한 결제가 정말 이 주문의 것인지 — 다른 주문의 결제를 끌어다 권한을 받는 것을 막는다. */
    private void assertSamePayment(WebOrderEntity order, TossPayment payment) {
        boolean same = payment.isDone()
                && order.getOrderId().equals(payment.getOrderId())
                && order.getAmount() == payment.getTotalAmount();
        if (!same) {
            log.error("토스 결제가 주문과 다르다: orderId={}, toss(orderId={}, status={}, amount={})",
                    order.getOrderId(), payment.getOrderId(), payment.getStatus(), payment.getTotalAmount());
            throw PaymentException.rejected("결제 정보가 주문과 일치하지 않습니다. 고객센터로 문의해 주세요.");
        }
    }
}
