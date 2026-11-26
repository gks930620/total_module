package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.billing.dto.TossPayment;
import com.businesscard.common.exception.PaymentException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.Map;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * 토스페이먼츠 결제 API — <b>물어보고, 답을 우리 말로 옮기는</b> 일만 한다.
 *
 * <p>공식 SDK 없이 RestClient 로 부른다 — 필요한 건 엔드포인트 두 개(승인·조회)뿐이다
 * (새 라이브러리 도입은 senior-dev 결정 사항이라는 프로젝트 규칙도 있다).
 *
 * <p>인증: {@code Authorization: Basic base64(시크릿키 + ":")} — 시크릿 키 뒤에 콜론을 붙인다(토스 규칙).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TossPaymentsClient implements TossPaymentsGateway {

    private static final String CONFIRM_PATH = "/v1/payments/confirm";
    /** 경로 변수는 반드시 URI 템플릿으로 넘긴다 — 문자열 이어붙이기는 경로 조작에 열려 있다. */
    private static final String PAYMENT_PATH = "/v1/payments/{paymentKey}";

    private final BillingProperties billingProperties;
    private final RestClient tossRestClient;
    private final ObjectMapper objectMapper;

    @Override
    public boolean isConfigured() {
        return isNotBlank(billingProperties.getTossSecretKey()) && isNotBlank(billingProperties.getTossClientKey());
    }

    @Override
    public TossPayment confirm(String paymentKey, String orderId, long amount) {
        requireConfigured();
        Map<String, Object> body = Map.of("paymentKey", paymentKey, "orderId", orderId, "amount", amount);
        return toPayment(call(() -> tossRestClient.post()
                .uri(baseUrl() + CONFIRM_PATH)
                .header(HttpHeaders.AUTHORIZATION, basicAuth())
                // 같은 결제의 승인을 다시 보내도 토스가 첫 응답을 그대로 돌려준다(15일간) — 재시도에 안전하다.
                .header("Idempotency-Key", paymentKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class)));
    }

    @Override
    public TossPayment getPayment(String paymentKey) {
        requireConfigured();
        return toPayment(call(() -> tossRestClient.get()
                .uri(baseUrl() + PAYMENT_PATH, paymentKey)
                .header(HttpHeaders.AUTHORIZATION, basicAuth())
                .retrieve()
                .body(JsonNode.class)));
    }

    private JsonNode call(Supplier<JsonNode> request) {
        try {
            JsonNode body = request.get();
            if (body == null) {
                throw PaymentException.unavailable("결제사 응답이 비어 있습니다.");
            }
            return body;
        } catch (HttpClientErrorException e) {
            JsonNode error = readError(e.getResponseBodyAsString(StandardCharsets.UTF_8));
            String code = error.path("code").asText("UNKNOWN");
            if (e.getStatusCode().value() == 401) {
                // 키가 틀렸다 — 사용자 잘못이 아니라 우리 설정 문제다. 운영자가 알아채도록 error 로 남긴다.
                log.error("토스 인증 실패({}): 시크릿 키(APP_BILLING_TOSS_SECRET_KEY)를 확인할 것.", code);
                throw PaymentException.unavailable("결제 설정에 문제가 있습니다. 잠시 후 다시 시도해 주세요.");
            }
            throw new TossPaymentsException(
                    e.getStatusCode().value(), code, error.path("message").asText("결제를 처리하지 못했습니다."));
        } catch (RestClientException e) {
            // 5xx, 타임아웃, 연결 실패 — 결과를 모른다. 승인으로 치지 않고 "잠시 후 다시"로 돌린다.
            // (재시도는 Idempotency-Key 덕분에 안전하고, 놓친 승인은 웹훅으로도 복구된다)
            log.warn("토스 API 호출 실패: {}", e.getMessage());
            throw PaymentException.unavailable("결제사 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    private TossPayment toPayment(JsonNode json) {
        return TossPayment.builder()
                .paymentKey(json.path("paymentKey").asText(null))
                .orderId(json.path("orderId").asText(null))
                .status(json.path("status").asText(null))
                .totalAmount(json.path("totalAmount").asLong(-1))
                .method(json.path("method").asText(null))
                .approvedAt(toServerTime(json.path("approvedAt").asText(null)))
                .build();
    }

    /** 토스는 "2026-11-24T10:00:00+09:00" 형식이다. 우리 엔티티의 다른 시각들처럼 서버 시간대로 옮긴다. */
    private LocalDateTime toServerTime(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(text).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private JsonNode readError(String body) {
        try {
            return objectMapper.readTree(body == null || body.isBlank() ? "{}" : body);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw PaymentException.unavailable("결제가 아직 준비되지 않았습니다.");
        }
    }

    private String basicAuth() {
        String credentials = billingProperties.getTossSecretKey() + ":";
        return "Basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private String baseUrl() {
        String base = billingProperties.getTossApiBaseUrl();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
}
