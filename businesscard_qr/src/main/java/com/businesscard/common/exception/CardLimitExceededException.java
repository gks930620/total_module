package com.businesscard.common.exception;

import org.springframework.http.HttpStatus;

/**
 * 무료 사용자가 명함 등록 한도를 넘겼을 때.
 * HTTP 400 Bad Request, errorCode {@code CARD_LIMIT_EXCEEDED}
 *
 * <p>앱은 이 <b>errorCode</b> 를 보고 결제 화면을 띄운다(문구는 앱이 번역한다).
 * 그래서 일반 {@link BusinessRuleException} 과 코드를 구분한다 — 설계 §3-3.
 */
public class CardLimitExceededException extends BusinessException {

    public CardLimitExceededException(int limit) {
        super(
                "무료 플랜의 명함 등록 한도(%d장)를 초과했습니다.".formatted(limit),
                HttpStatus.BAD_REQUEST,
                "CARD_LIMIT_EXCEEDED"
        );
    }
}
