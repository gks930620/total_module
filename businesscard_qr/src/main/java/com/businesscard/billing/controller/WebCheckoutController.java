package com.businesscard.billing.controller;

import com.businesscard.billing.dto.EntitlementResponse;
import com.businesscard.billing.dto.LifetimeOfferResponse;
import com.businesscard.billing.dto.TossWebhookRequest;
import com.businesscard.billing.dto.WebOrderResponse;
import com.businesscard.billing.dto.WebPaymentConfirmRequest;
import com.businesscard.billing.service.WebCheckoutService;
import com.businesscard.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 웹 결제 API — 프로 평생 이용권. 계약: {@code 설계/웹결제_설계.md} §3.
 *
 * <p>사용자는 항상 {@code authentication.getName()}(세션 주체)에서 꺼낸다 — 클라이언트가 보낸 식별자를 믿지 않는다.
 * 웹훅만 예외로 로그인 없이 온다(토스가 부른다).
 */
@RestController
@RequestMapping("/api/billing/web")
@RequiredArgsConstructor
public class WebCheckoutController {

    private final WebCheckoutService webCheckoutService;

    /** 프로 화면에 보여줄 가격·구매 가능 여부. */
    @GetMapping("/lifetime")
    public ResponseEntity<ApiResponse<LifetimeOfferResponse>> lifetimeOffer() {
        return ResponseEntity.ok(ApiResponse.success("Lifetime offer loaded", webCheckoutService.getLifetimeOffer()));
    }

    /** 주문 생성 — 응답의 값으로 웹앱이 토스 결제창을 연다. */
    @PostMapping("/orders")
    public ResponseEntity<ApiResponse<WebOrderResponse>> createOrder(Authentication authentication) {
        WebOrderResponse data = webCheckoutService.createLifetimeOrder(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success("Order created", data));
    }

    /** 결제 승인 — 토스 성공 주소로 돌아온 웹앱이 부른다. 성공하면 바뀐 자격을 돌려준다. */
    @PostMapping("/orders/{orderId}/confirm")
    public ResponseEntity<ApiResponse<EntitlementResponse>> confirm(
            Authentication authentication,
            @PathVariable String orderId,
            @Valid @RequestBody WebPaymentConfirmRequest request
    ) {
        EntitlementResponse data = webCheckoutService.confirm(authentication.getName(), orderId, request);
        return ResponseEntity.ok(ApiResponse.success("Payment confirmed", data));
    }

    /**
     * 토스 → 우리: 결제 상태가 바뀌었다(환불 등). 토스 개발자센터 > 웹훅에 이 주소를 등록한다.
     * 10초 안에 200 을 받지 못하면 토스가 다시 보낸다.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody TossWebhookRequest event) {
        webCheckoutService.handleWebhook(event);
        return ResponseEntity.ok().build();
    }
}
