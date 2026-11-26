package com.businesscard.billing.service;

import com.businesscard.billing.entity.SubscriptionStatus;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

/**
 * 스토어가 실제로 확인해 준 구매 상태.
 *
 * <p>클라이언트가 보낸 값이 아니라 <b>스토어 서버가 답한 값</b>만 담는다.
 * 우리가 권한을 줄지 말지는 오직 이 객체를 근거로 정한다.
 */
@Getter
@Builder
public class VerifiedPurchase {

    private final String productId;
    private final String purchaseToken;
    private final SubscriptionStatus status;

    /** 스토어가 만료 시각을 안 주면 null — 그때는 프로로 치지 않는다. */
    private final LocalDateTime expiresAt;

    private final boolean autoRenewing;
}
