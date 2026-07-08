package com.businesscard.card.support;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 클라이언트에 내려줄 절대 URL의 베이스를 결정한다.
 *
 * <p>app.public-base-url(APP_PUBLIC_BASE_URL)이 설정되어 있으면 그 값을 사용하고,
 * 비어 있으면 기존처럼 X-Forwarded 헤더 기반의 현재 요청 컨텍스트에서 추론한다.
 * 리버스 프록시(dist_api_gateway) 뒤에서 헤더 추론이 흔들려도 URL이 안정적으로 유지되도록 한다.
 */
@Component
public class PublicUrlResolver {

    private final String publicBaseUrl;

    public PublicUrlResolver(@Value("${app.public-base-url:}") String publicBaseUrl) {
        this.publicBaseUrl = normalize(publicBaseUrl);
    }

    /** 절대 URL 생성을 시작할 UriComponentsBuilder를 반환한다. */
    public UriComponentsBuilder baseUriBuilder() {
        if (publicBaseUrl != null) {
            return UriComponentsBuilder.fromUriString(publicBaseUrl);
        }
        return ServletUriComponentsBuilder.fromCurrentContextPath();
    }

    private static String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        // 뒤에 붙은 슬래시는 제거해 path 결합 시 이중 슬래시를 방지한다.
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed.isBlank() ? null : trimmed;
    }
}
