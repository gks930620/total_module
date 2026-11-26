package com.businesscard.billing.controller;

import com.businesscard.billing.dto.EntitlementResponse;
import com.businesscard.billing.dto.PurchaseVerifyRequest;
import com.businesscard.billing.service.BillingService;
import com.businesscard.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인앱결제 API. 계약: {@code 설계/인앱결제_설계.md} §3.
 *
 * <p>사용자는 항상 {@code authentication.getName()}(JWT 주체)에서 꺼낸다 —
 * 클라이언트가 보낸 식별자를 믿지 않는다(코드컨벤션 §4-1).
 */
@RestController
@RequestMapping("/api/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    /** 지금 프로인지 + 명함을 몇 장 더 만들 수 있는지. 앱은 시작 시와 결제 후에 부른다. */
    @GetMapping("/entitlement")
    public ResponseEntity<ApiResponse<EntitlementResponse>> getEntitlement(Authentication authentication) {
        EntitlementResponse data = billingService.getEntitlement(authentication.getName());
        return ResponseEntity.ok(ApiResponse.success("Entitlement loaded", data));
    }

    /** 스토어 결제 직후 앱이 영수증을 보내 검증받는다. 서버가 직접 스토어에 확인한다. */
    @PostMapping("/purchases/verify")
    public ResponseEntity<ApiResponse<EntitlementResponse>> verifyPurchase(
            Authentication authentication,
            @Valid @RequestBody PurchaseVerifyRequest request
    ) {
        EntitlementResponse data = billingService.verifyPurchase(authentication.getName(), request);
        return ResponseEntity.ok(ApiResponse.success("Purchase verified", data));
    }
}
