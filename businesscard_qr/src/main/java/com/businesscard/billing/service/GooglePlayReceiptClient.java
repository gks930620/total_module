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
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Google Play 구독 영수증 검증 — <b>물어보고, 답을 우리 말로 옮기는</b> 일만 한다.
 * 설계 §4-1.
 *
 * <p>인증 토큰 발급은 {@link GoogleOAuthTokenProvider} 가 맡는다.
 *
 * <p>Google 공식 클라이언트 라이브러리(google-api-client)를 쓰지 않는다 — 의존성이 무겁고
 * 우리가 필요한 건 엔드포인트 두 개뿐이라, 이미 있는 jjwt + RestClient 로 충분하다.
 * (새 라이브러리 도입은 senior-dev 결정 사항이라는 프로젝트 규칙도 있다.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GooglePlayReceiptClient implements StoreReceiptClient {

    private static final String BASE = "https://androidpublisher.googleapis.com";

    /** 경로 변수는 반드시 URI 템플릿으로 넘긴다 — 문자열 이어붙이기는 경로 조작에 열려 있다. */
    private static final String SUBSCRIPTION_URI_TEMPLATE =
            BASE + "/androidpublisher/v3/applications/{packageName}"
                    + "/purchases/subscriptionsv2/tokens/{token}";
    private static final String ACKNOWLEDGE_URI_TEMPLATE =
            BASE + "/androidpublisher/v3/applications/{packageName}"
                    + "/purchases/subscriptions/{productId}/tokens/{token}:acknowledge";

    private static final String ACK_PENDING = "ACKNOWLEDGEMENT_STATE_PENDING";

    private final BillingProperties billingProperties;
    private final GoogleOAuthTokenProvider tokenProvider;
    private final ObjectMapper objectMapper;
    private final RestClient storeRestClient;

    @Override
    public Store store() {
        return Store.GOOGLE_PLAY;
    }

    @Override
    public boolean isConfigured() {
        return isNotBlank(billingProperties.getGoogleServiceAccountJson())
                && isNotBlank(billingProperties.getGooglePackageName());
    }

    @Override
    public VerifiedPurchase verify(String productId, String purchaseToken) {
        JsonNode subscription = fetchSubscription(purchaseToken);

        JsonNode lineItem = subscription.path("lineItems").path(0);
        String resolvedProductId = lineItem.path("productId").asText(productId);

        // ⚠️ 승인하지 않으면 Google 이 3일 뒤 자동 환불한다. 권한을 준 뒤 반드시 승인한다.
        acknowledgeIfNeeded(subscription, resolvedProductId, purchaseToken);

        return VerifiedPurchase.builder()
                .productId(resolvedProductId)
                .purchaseToken(purchaseToken)
                .status(toStatus(subscription.path("subscriptionState").asText()))
                .expiresAt(parseRfc3339(lineItem.path("expiryTime").asText(null)))
                .autoRenewing(lineItem.path("autoRenewingPlan").path("autoRenewEnabled").asBoolean(false))
                .build();
    }

    private JsonNode fetchSubscription(String purchaseToken) {
        try {
            String body = storeRestClient.get()
                    .uri(SUBSCRIPTION_URI_TEMPLATE, billingProperties.getGooglePackageName(), purchaseToken)
                    .header("Authorization", "Bearer " + tokenProvider.accessToken())
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(body);
        } catch (HttpClientErrorException e) {
            // 4xx = 그런 구매가 없다(위조·취소·오타). 사용자 입력 문제이므로 400 으로 돌려준다.
            // 응답 본문에는 구매 토큰이 섞여 들어올 수 있어 상태코드만 남긴다.
            log.warn("Google Play 구독 조회 실패 (client error): status={}", e.getStatusCode());
            throw new BusinessRuleException("유효하지 않은 결제 정보입니다.");
        } catch (Exception e) {
            // 5xx·타임아웃·네트워크·파싱 실패 = 우리/스토어 문제. 사용자에게 재시도를 안내한다.
            log.error("Google Play 구독 조회 실패: {}", e.getClass().getSimpleName());
            throw new StoreUnavailableException("Google Play 에 연결할 수 없습니다.");
        }
    }

    private void acknowledgeIfNeeded(JsonNode subscription, String productId, String purchaseToken) {
        if (!ACK_PENDING.equals(subscription.path("acknowledgementState").asText(""))) {
            return;
        }
        try {
            storeRestClient.post()
                    .uri(ACKNOWLEDGE_URI_TEMPLATE,
                            billingProperties.getGooglePackageName(), productId, purchaseToken)
                    .header("Authorization", "Bearer " + tokenProvider.accessToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{}")
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            // 승인 실패로 사용자 결제를 되돌리지는 않는다. 다음 검증 요청에서 다시 시도된다.
            log.error("Google Play 구매 승인(acknowledge) 실패 — 3일 내 재시도되지 않으면 자동 환불된다: {}",
                    e.getClass().getSimpleName());
        }
    }

    /** Google 의 subscriptionState → 우리 도메인 상태. */
    private SubscriptionStatus toStatus(String subscriptionState) {
        return switch (subscriptionState) {
            // 유예 기간(결제 재시도 중)도 서비스는 계속 열어 준다 — Google 권장 동작.
            case "SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" -> SubscriptionStatus.ACTIVE;
            // 해지했지만 남은 기간은 쓸 수 있다.
            case "SUBSCRIPTION_STATE_CANCELED" -> SubscriptionStatus.CANCELED;
            case "SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED" -> SubscriptionStatus.PENDING;
            // 보류·일시정지는 접근을 막아야 한다.
            case "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_EXPIRED" -> SubscriptionStatus.EXPIRED;
            default -> {
                log.warn("알 수 없는 Google 구독 상태: {}", subscriptionState);
                yield SubscriptionStatus.EXPIRED;
            }
        };
    }

    private LocalDateTime parseRfc3339(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        // 앱 전체가 시스템 기본 시간대의 LocalDateTime 으로 비교하므로 같은 기준으로 맞춘다.
        return LocalDateTime.ofInstant(Instant.parse(value), ZoneId.systemDefault());
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
