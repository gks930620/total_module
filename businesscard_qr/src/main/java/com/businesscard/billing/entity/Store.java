package com.businesscard.billing.entity;

/** 결제가 일어난 스토어. 영수증 검증 방식이 스토어마다 다르므로 함께 저장한다. */
public enum Store {
    GOOGLE_PLAY,
    APP_STORE
}
