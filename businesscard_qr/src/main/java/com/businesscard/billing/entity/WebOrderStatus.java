package com.businesscard.billing.entity;

/** 웹 결제 주문 상태. 설계 {@code 설계/웹결제_설계.md} §2. */
public enum WebOrderStatus {

    /** 주문만 만들었다 — 결제창을 열었거나 열기 전. 돈은 아직 빠져나가지 않았다. */
    PENDING,

    /** 토스 승인 완료. 평생 이용권이면 이 상태인 동안 프로다. */
    PAID,

    /** 전액 환불됐다(운영자가 토스 관리자 화면에서 취소). 권한을 거둔다. */
    CANCELED
}
