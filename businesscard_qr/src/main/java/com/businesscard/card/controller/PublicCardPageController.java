package com.businesscard.card.controller;

import com.businesscard.card.service.PublicBusinessCardService;
import com.businesscard.card.support.PublicCardPageRenderer;
import com.businesscard.common.web.Robots;
import com.businesscard.common.web.SupportedLanguages;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

/**
 * 받는 사람이 여는 공개 명함 화면 {@code /c/{id}} — 링크·QR 로 들어오는 가장 흔한 진입점.
 *
 * <p>다른 웹앱 화면은 {@code SpaController} 가 index.html 을 그대로 내주지만, 이 경로만은
 * 카톡에 링크를 붙였을 때 <b>누구의 명함인지</b> 보이도록 미리보기 태그를 채워서 내준다
 * ({@link PublicCardPageRenderer}).
 */
@Controller
@RequiredArgsConstructor
public class PublicCardPageController {

    private static final MediaType HTML = new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8);

    private final PublicBusinessCardService publicBusinessCardService;
    private final PublicCardPageRenderer pageRenderer;

    @GetMapping("/c/{cardId}")
    public ResponseEntity<String> page(
            @PathVariable String cardId,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage
    ) {
        // 미리보기 수집기는 대개 언어를 밝히지 않는다. 주 공유 채널(카카오톡)이 한국어라 기본을 한국어로 둔다.
        String language = SupportedLanguages.resolve(null, acceptLanguage, SupportedLanguages.KOREAN);
        return publicBusinessCardService.findPreview(cardId)
                .map(card -> html(HttpStatus.OK, pageRenderer.render(card, language)))
                // 없거나 지운 명함 — 미리보기 없이 웹앱 화면만 내준다. 웹앱이 "명함을 찾을 수 없어요"를 그린다.
                .orElseGet(() -> html(HttpStatus.NOT_FOUND, pageRenderer.shell()));
    }

    private ResponseEntity<String> html(HttpStatus status, String body) {
        return ResponseEntity.status(status)
                .contentType(HTML)
                // 명함을 고치면 다음 공유부터 새 내용이 보여야 한다.
                .cacheControl(CacheControl.noCache())
                // 언어마다 사이트 이름이 다르다(명함QR / Businesscard QR).
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE)
                .header(Robots.HEADER, Robots.NOINDEX)
                .body(body);
    }
}
