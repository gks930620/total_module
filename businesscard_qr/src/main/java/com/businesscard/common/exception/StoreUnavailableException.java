package com.businesscard.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 스토어(Google Play / App Store)에 물어볼 수 없을 때.
 * HTTP 503 Service Unavailable
 *
 * <p>자격증명이 없거나 스토어가 응답하지 않는 경우다. <b>우리 쪽 문제이지 사용자 잘못이 아니므로</b>
 * 4xx 가 아니라 503 으로 내려 앱이 "잠시 후 다시" 안내하게 한다.
 * 이때 절대로 통과시키지 않는다 — "설정 없으면 승인"은 그대로 결제 우회 구멍이 된다.
 */
public class StoreUnavailableException extends BusinessException {

    public StoreUnavailableException(String message) {
        super(message, HttpStatus.SERVICE_UNAVAILABLE, "STORE_UNAVAILABLE");
    }
}
