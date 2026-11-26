package com.businesscard.billing.entity;

/**
 * 구독 상태. 스토어마다 이름이 달라(Google {@code subscriptionState}, Apple {@code status})
 * 우리 도메인 용어로 통일해 저장한다.
 */
public enum SubscriptionStatus {

    /** 결제 완료·유효. 만료 시각이 아직 남아 있으면 프로다. */
    ACTIVE,

    /** 결제 대기(계좌이체 등). 아직 권한을 주면 안 된다. */
    PENDING,

    /** 사용자가 갱신을 껐다. **만료 시각까지는 여전히 프로다.** */
    CANCELED,

    /** 기간이 끝났다. */
    EXPIRED,

    /** 환불·강제 회수. 즉시 권한 없음. */
    REVOKED;

    /** 이 상태가 (만료 시각과 무관하게) 프로 권한을 줄 수 있는 상태인지. */
    public boolean grantsAccess() {
        return this == ACTIVE || this == CANCELED;
    }
}
