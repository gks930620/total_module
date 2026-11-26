package com.businesscard.billing.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 결제 승인 요청 — 토스가 성공 주소({@code /pro/success?paymentKey=…&orderId=…&amount=…})로 돌려보낸 값을
 * 웹앱이 그대로 옮겨 보낸다. 주문번호는 경로에 있다.
 *
 * <p><b>여기 있는 값은 전부 브라우저를 거쳐 왔다 — 믿지 않는다.</b>
 * 금액은 주문 금액과 비교하고, 결제는 토스에 승인을 받아야만 인정한다.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class WebPaymentConfirmRequest {

    /**
     * 토스 paymentKey 형식(영문·숫자·{@code _}·{@code -}, 200자 이하).
     * 결제 조회 API 의 <b>URL 경로</b>에 들어가므로 {@code /}·{@code ..} 같은 값을 토스에 보내기 전에 막는다.
     */
    public static final String PAYMENT_KEY_PATTERN = "^[A-Za-z0-9_-]{1,200}$";

    @JsonProperty("payment_key")
    @NotBlank(message = "payment_key 는 필수입니다.")
    @Pattern(regexp = PAYMENT_KEY_PATTERN, message = "payment_key 형식이 올바르지 않습니다.")
    private String paymentKey;

    @NotNull(message = "amount 는 필수입니다.")
    @Positive(message = "amount 는 0보다 커야 합니다.")
    private Long amount;
}
