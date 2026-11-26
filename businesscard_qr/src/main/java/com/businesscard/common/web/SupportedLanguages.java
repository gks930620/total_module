package com.businesscard.common.web;

import java.util.List;
import java.util.Locale;

/**
 * 서버가 직접 글자를 만들어 내보내는 곳(PWA manifest, 명함 링크 미리보기)이 쓰는 언어 규칙.
 *
 * <p>목록은 웹앱({@code frontend/src/lib/i18n.js} SUPPORTED_LANGUAGES)과 같다.
 * 앱 이름 규칙도 여기 한 곳에 둔다 — "한국어는 '명함QR', 그 밖의 언어는 'Businesscard QR'".
 */
public final class SupportedLanguages {

    public static final String KOREAN = "ko";
    public static final String ENGLISH = "en";

    public static final List<String> CODES = List.of("ko", "en", "ja", "zh", "es", "de");

    private SupportedLanguages() {
    }

    /**
     * 우선순위: {@code requested}(웹앱이 실어 보낸 사용자 설정) → Accept-Language → {@code fallback}.
     *
     * <p>지원 목록에 있는 값만 돌려준다. 들어온 값을 그대로 응답에 비추지 않는다 —
     * {@code ?lang=<script>} 같은 값이 와도 응답에는 정해진 코드만 나간다.
     */
    public static String resolve(String requested, String acceptLanguage, String fallback) {
        if (requested != null && CODES.contains(requested)) {
            return requested;
        }
        if (acceptLanguage != null && !acceptLanguage.isBlank()) {
            try {
                for (Locale.LanguageRange range : Locale.LanguageRange.parse(acceptLanguage)) {
                    // "ko-KR" → "ko". 지역 변형은 따로 번역하지 않는다.
                    String base = range.getRange().split("-")[0].toLowerCase(Locale.ROOT);
                    if (CODES.contains(base)) {
                        return base;
                    }
                }
            } catch (IllegalArgumentException ignored) {
                // 형식이 깨진 헤더 — 기본 언어로 간다
            }
        }
        return fallback;
    }

    public static String appName(String language) {
        return KOREAN.equals(language) ? "명함QR" : "Businesscard QR";
    }
}
