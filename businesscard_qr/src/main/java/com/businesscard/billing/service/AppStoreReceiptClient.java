package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionStatus;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.StoreUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Apple App Store 구독 영수증 검증 — <b>물어보고, 답을 우리 말로 옮기는</b> 일만 한다.
 * 설계 §4-2.
 *
 * <p>앱이 보내는 {@code purchaseToken} 은 Apple 의 거래 식별자다. App Store Server API 의
 * 구독 조회는 그 구독에 속한 <b>어떤 거래 ID 로도</b> 조회된다.
 *
 * <p>인증 토큰 발급은 {@link AppStoreApiTokenProvider}, 서명된 응답 해석은
 * {@link AppStoreJwsReader} 가 맡는다(서명 체인을 검증하지 않는 이유도 거기에 적혀 있다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppStoreReceiptClient implements StoreReceiptClient {

    private static final String PRODUCTION_BASE = "https://api.storekit.itunes.apple.com";
    private static final String SANDBOX_BASE = "https://api.storekit-sandbox.itunes.apple.com";

    /** 경로 변수는 반드시 URI 템플릿으로 넘긴다 — 문자열 이어붙이기는 경로 조작에 열려 있다. */
    private static final String SUBSCRIPTION_PATH_TEMPLATE = "/inApps/v1/subscriptions/{transactionId}";

    private final BillingProperties billingProperties;
    private final AppStoreApiTokenProvider tokenProvider;
    private final AppStoreJwsReader jwsReader;
    private final ObjectMapper objectMapper;
    private final RestClient storeRestClient;

    @Override
    public Store store() {
        return Store.APP_STORE;
    }

    @Override
    public boolean isConfigured() {
        return isNotBlank(billingProperties.getAppleIssuerId())
                && isNotBlank(billingProperties.getAppleKeyId())
                && isNotBlank(billingProperties.getApplePrivateKey())
                && isNotBlank(billingProperties.getAppleBundleId());
    }

    @Override
    public VerifiedPurchase verify(String productId, String transactionId) {
        JsonNode lastTransaction = fetchLastTransaction(transactionId);

        JsonNode transactionInfo = jwsReader.readPayload(lastTransaction.path("signedTransactionInfo").asText(null));
        JsonNode renewalInfo = jwsReader.readPayload(lastTransaction.path("signedRenewalInfo").asText(null));

        return VerifiedPurchase.builder()
                .productId(transactionInfo.path("productId").asText(productId))
                .purchaseToken(transactionId)
                .status(toStatus(lastTransaction.path("status").asInt(-1)))
                .expiresAt(parseEpochMillis(transactionInfo.path("expiresDate").asLong(0L)))
                .autoRenewing(renewalInfo.path("autoRenewStatus").asInt(0) == 1)
                .build();
    }

    private JsonNode fetchLastTransaction(String transactionId) {
        try {
            String body = storeRestClient.get()
                    .uri(apiBase() + SUBSCRIPTION_PATH_TEMPLATE, transactionId)
                    .header("Authorization", "Bearer " + tokenProvider.signedToken())
                    .retrieve()
                    .body(String.class);

            JsonNode lastTransaction = objectMapper.readTree(body)
                    .path("data").path(0)
                    .path("lastTransactions").path(0);

            if (lastTransaction.isMissingNode() || lastTransaction.isNull()) {
                throw new BusinessRuleException("유효하지 않은 결제 정보입니다.");
            }
            return lastTransaction;
        } catch (HttpClientErrorException e) {
            // 4xx = 그런 거래가 없다(위조·오타). 사용자 입력 문제이므로 400.
            // 응답 본문에는 거래 식별자가 섞여 들어올 수 있어 상태코드만 남긴다.
            log.warn("App Store 구독 조회 실패 (client error): status={}", e.getStatusCode());
            throw new BusinessRuleException("유효하지 않은 결제 정보입니다.");
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            // 타임아웃·네트워크·파싱 실패 모두 여기로 온다.
            log.error("App Store 구독 조회 실패: {}", e.getClass().getSimpleName());
            throw new StoreUnavailableException("App Store 에 연결할 수 없습니다.");
        }
    }

    /** Apple 의 구독 status 코드 → 우리 도메인 상태. */
    private SubscriptionStatus toStatus(int status) {
        return switch (status) {
            case 1 -> SubscriptionStatus.ACTIVE;
            // 2 = 만료, 3 = 결제 재시도(billing retry). 둘 다 접근을 막는다.
            case 2, 3 -> SubscriptionStatus.EXPIRED;
            // 4 = 유예 기간. 서비스는 계속 열어 준다 — Apple 권장 동작.
            case 4 -> SubscriptionStatus.ACTIVE;
            case 5 -> SubscriptionStatus.REVOKED;
            default -> {
                log.warn("알 수 없는 App Store 구독 상태: {}", status);
                yield SubscriptionStatus.EXPIRED;
            }
        };
    }

    private String apiBase() {
        return "sandbox".equalsIgnoreCase(billingProperties.getAppleEnvironment())
                ? SANDBOX_BASE
                : PRODUCTION_BASE;
    }

    private LocalDateTime parseEpochMillis(long epochMillis) {
        if (epochMillis <= 0) {
            return null;
        }
        // 앱 전체가 시스템 기본 시간대의 LocalDateTime 으로 비교하므로 같은 기준으로 맞춘다.
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(epochMillis), ZoneId.systemDefault());
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
