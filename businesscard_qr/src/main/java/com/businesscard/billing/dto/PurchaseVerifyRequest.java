package com.businesscard.billing.dto;

import com.businesscard.billing.entity.Store;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 앱이 스토어 결제를 마친 뒤 서버에 검증을 요청하는 본문. 설계 §3-2.
 *
 * <p>사용자 식별값(userId)은 <b>일부러 받지 않는다.</b> 인증 토큰 주체에서만 꺼낸다
 * (코드컨벤션 §4-1) — 클라이언트가 남의 userId 를 보내 구독을 붙이는 것을 원천 차단한다.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PurchaseVerifyRequest {

    @NotNull(message = "store 는 필수입니다.")
    private Store store;

    @NotBlank(message = "productId 는 필수입니다.")
    private String productId;

    /**
     * Google 은 purchaseToken, Apple 은 originalTransactionId 를 넣는다.
     *
     * <p><b>형식을 엄격히 제한하는 이유:</b> 이 값은 스토어 API 의 <b>URL 경로</b>에 그대로 들어간다.
     * {@code /} 나 {@code ..} 를 허용하면 경로를 조작해 다른 패키지의 구매를 조회하게 만들 수 있고,
     * {@code ?} · {@code #} · {@code {}} 는 쿼리·URI 템플릿으로 해석돼 요청이 뒤틀린다.
     *
     * <p>실제 값은 Google 이 base64url, Apple 이 숫자 문자열이라 이 집합으로 충분하다.
     * 덤으로, 쓰레기 값을 <b>외부 API 를 두들기기 전에</b> 걸러 준다.
     */
    @NotBlank(message = "purchaseToken 은 필수입니다.")
    @Pattern(
            regexp = "^[A-Za-z0-9._~-]{1,512}$",
            message = "purchaseToken 형식이 올바르지 않습니다."
    )
    private String purchaseToken;
}
