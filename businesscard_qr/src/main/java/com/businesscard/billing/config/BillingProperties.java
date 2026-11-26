package com.businesscard.billing.config;

import java.util.List;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 결제 설정. 값은 전부 환경변수로 주입되고 기본값이 있어 로컬에서도 그대로 뜬다
 * (코드컨벤션 §5 — 코드 분기 없이 설정으로만 환경을 흡수한다).
 */
@Getter
@Component
public class BillingProperties {

    /** 무료 플랜의 명함 등록 한도. 이미 만든 명함은 이 값이 줄어도 계속 볼 수 있다. */
    @Value("${app.billing.free-card-limit:3}")
    private int freeCardLimit;

    /** 프로 권한을 주는 상품 ID 목록. 여기 없는 상품으로 검증 요청이 오면 400 이다. */
    @Value("${app.billing.pro-product-ids:pro_monthly}")
    private List<String> proProductIds;

    // ── Google Play ──
    /** 서비스 계정 JSON 전체. 비어 있으면 Google 검증이 꺼진다. */
    @Value("${app.billing.google.service-account-json:}")
    private String googleServiceAccountJson;

    @Value("${app.billing.google.package-name:}")
    private String googlePackageName;

    // ── Apple App Store ──
    @Value("${app.billing.apple.issuer-id:}")
    private String appleIssuerId;

    @Value("${app.billing.apple.key-id:}")
    private String appleKeyId;

    /** App Store Connect API 개인키(.p8) 내용. 비어 있으면 Apple 검증이 꺼진다. */
    @Value("${app.billing.apple.private-key:}")
    private String applePrivateKey;

    @Value("${app.billing.apple.bundle-id:}")
    private String appleBundleId;

    /** 운영은 production, 샌드박스 테스트는 sandbox. */
    @Value("${app.billing.apple.environment:production}")
    private String appleEnvironment;

    // ── 웹 결제(토스페이먼츠) — 프로 평생 이용권. 설계 웹결제_설계.md ──

    /** 평생 이용권 가격(원). 바꿔도 이미 만든 주문의 금액은 그대로다(주문에 고정된다). */
    @Value("${app.billing.web.lifetime-price:9900}")
    private long lifetimePrice;

    /** 토스 클라이언트 키(test_ck_… / live_ck_…) — 브라우저가 결제창을 여는 데 쓰는 공개 키. */
    @Value("${app.billing.toss.client-key:}")
    private String tossClientKey;

    /** 토스 시크릿 키(test_sk_… / live_sk_…) — 서버에만 둔다. 비어 있으면 웹 결제가 꺼진다(503). */
    @Value("${app.billing.toss.secret-key:}")
    private String tossSecretKey;

    @Value("${app.billing.toss.api-base-url:https://api.tosspayments.com}")
    private String tossApiBaseUrl;

    public boolean isProProduct(String productId) {
        return proProductIds.contains(productId);
    }
}
