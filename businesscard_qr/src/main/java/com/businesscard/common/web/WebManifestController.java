package com.businesscard.common.web;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * PWA manifest — 홈 화면에 설치될 때의 이름·아이콘·시작 화면.
 *
 * <p><b>왜 정적 파일이 아닌가:</b> 앱 이름 규칙이 "한국어는 '명함QR', 그 밖의 언어는 'Businesscard QR'" 인데
 * manifest 파일은 이름을 하나만 가질 수 있다. 그래서 언어를 보고 서버가 만들어 준다.
 *
 * <p>언어 우선순위: {@code ?lang=} (웹앱이 사용자의 언어 설정을 실어 보낸다) → Accept-Language → 영어.
 */
@RestController
public class WebManifestController {

    private static final MediaType MANIFEST = MediaType.parseMediaType("application/manifest+json;charset=UTF-8");

    private static final Map<String, String> DESCRIPTIONS = Map.of(
            "ko", "QR코드와 링크로 명함을 공유하세요",
            "en", "Share your business card with a QR code and a link.",
            "ja", "QRコードとリンクで名刺を共有しましょう",
            "zh", "用二维码和链接分享你的名片",
            "es", "Comparte tu tarjeta de visita con un código QR y un enlace.",
            "de", "Teile deine Visitenkarte per QR-Code und Link.");

    @GetMapping("/manifest.webmanifest")
    public ResponseEntity<Map<String, Object>> manifest(
            @RequestParam(required = false) String lang,
            @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage
    ) {
        String resolved = SupportedLanguages.resolve(lang, acceptLanguage, SupportedLanguages.ENGLISH);
        String name = SupportedLanguages.appName(resolved);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("short_name", name);
        body.put("description", DESCRIPTIONS.get(resolved));
        body.put("lang", resolved);
        body.put("dir", "ltr");
        // 설치한 사람은 이미 로그인한 사용자다 — 첫 화면이 아니라 목록에서 연다.
        // (로그인이 풀려 있으면 웹앱이 알아서 첫 화면으로 보낸다)
        body.put("start_url", "/cards");
        body.put("scope", "/");
        body.put("display", "standalone");
        // 디자인 킷 Halo 의 --point / --bg 와 같은 값
        body.put("theme_color", "#6d5efc");
        body.put("background_color", "#f8f7fd");
        body.put("icons", List.of(
                icon("/icons/icon-192.png", "192x192", "any"),
                icon("/icons/icon-512.png", "512x512", "any"),
                // 안드로이드가 원·둥근사각형으로 잘라 쓰는 아이콘. 없으면 흰 테두리 안에 작게 들어간다.
                icon("/icons/icon-maskable-512.png", "512x512", "maskable")));

        return ResponseEntity.ok()
                .contentType(MANIFEST)
                // 언어마다 다른 응답이다 — 중간 캐시가 한국어 manifest 를 외국인에게 내주지 않게 한다.
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(body);
    }

    private Map<String, String> icon(String src, String sizes, String purpose) {
        return Map.of("src", src, "sizes", sizes, "type", "image/png", "purpose", purpose);
    }
}
