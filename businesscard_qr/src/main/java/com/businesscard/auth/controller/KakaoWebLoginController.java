package com.businesscard.auth.controller;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.service.AuthService;
import com.businesscard.auth.service.KakaoApiClient;
import com.businesscard.auth.support.AuthCookies;
import com.businesscard.common.web.PublicUrlResolver;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 웹 카카오 로그인 — 서버가 OAuth 인가 코드 흐름을 직접 처리한다.
 * 설계: {@code 설계/웹앱_전환_설계.md} §3-4.
 *
 * <pre>
 *  브라우저 ──▶ /authorize ──302──▶ 카카오 동의 화면
 *                                      │
 *  브라우저 ◀──302 /cards ◀── /callback ◀┘ (code, state)
 *            (세션 쿠키)       ├ state 대조 (로그인 CSRF 차단)
 *                              ├ code → 토큰 (서버에서, Client Secret 포함)
 *                              └ 세션 쿠키 발급
 * </pre>
 *
 * <p><b>왜 서버가 하나:</b> 브라우저에는 키도 토큰도 나가지 않는다. 프론트의 로그인 버튼은
 * {@code <a href="/api/auth/kakao/authorize">} 하나뿐이다. 카카오 SDK 스크립트도 안 싣는다.
 *
 * <p>doll_gacha 도 같은 흐름이지만 state 를 서버 메모리에 둔다. 여기선 <b>쿠키</b>에 둔다 —
 * Railway App Sleeping 으로 로그인 도중 재시작돼도 state 가 날아가지 않는다.
 *
 * <p>모든 응답이 302 다. 사용자가 <b>주소창으로 이동해 온</b> 요청이라 JSON 에러를 주면
 * 화면에 날 JSON 이 뜬다. 실패도 로그인 화면으로 돌려보내고 사유는 쿼리로 넘긴다.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth/kakao")
@RequiredArgsConstructor
public class KakaoWebLoginController {

    private static final String CALLBACK_PATH = "/api/auth/kakao/callback";

    /** 로그인 후 갈 곳. 쿼리로 받지 않는다 — 받으면 열린 리다이렉트(open redirect)가 된다. */
    private static final String AFTER_LOGIN = "/cards";

    /** 256비트. 추측·전수조사가 불가능한 크기. */
    private static final int STATE_BYTES = 32;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final KakaoApiClient kakaoApiClient;
    private final AuthService authService;
    private final AuthCookies authCookies;
    private final PublicUrlResolver publicUrlResolver;

    @GetMapping("/authorize")
    public ResponseEntity<Void> authorize() {
        if (!kakaoApiClient.isWebLoginConfigured()) {
            log.warn("웹 카카오 로그인 미설정 — APP_KAKAO_REST_API_KEY 를 넣어야 한다");
            return toLogin("not_configured");
        }

        String state = newState();
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(kakaoApiClient.authorizeUrl(state, callbackUri()))
                .header(HttpHeaders.SET_COOKIE, authCookies.oauthState(state).toString())
                .build();
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            HttpServletRequest request,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error
    ) {
        // ① state 대조가 맨 먼저다. 이게 틀리면 code 가 있든 없든 아무것도 하지 않는다.
        //    (로그인 CSRF — 공격자가 자기 code 를 피해자 브라우저에 밀어 넣어
        //     피해자를 공격자 계정으로 로그인시키는 공격을 막는다)
        Optional<String> expected = authCookies.readOauthState(request);
        if (expected.isEmpty() || state == null || !constantTimeEquals(expected.get(), state)) {
            return toLogin("invalid_state");
        }

        // ② 사용자가 동의 화면에서 "취소" — 오류가 아니라 의사 표시다.
        if (error != null) {
            return toLogin("cancelled");
        }
        if (code == null || code.isBlank()) {
            return toLogin("failed");
        }

        // ③ 서버에서 code → 토큰 → 사용자 동기화 → 우리 세션 발급
        AuthTokenResponse tokens;
        try {
            tokens = authService.loginWithKakaoCode(code, callbackUri());
        } catch (RuntimeException e) {
            // 만료·재사용된 code, redirect_uri 불일치 등. code 가 섞일 수 있어 메시지는 남기지 않는다.
            log.warn("웹 카카오 로그인 실패: {}", e.getClass().getSimpleName());
            return toLogin("failed");
        }

        ResponseEntity.BodyBuilder redirect = ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(AFTER_LOGIN))
                .header(HttpHeaders.SET_COOKIE, authCookies.clearedOauthState().toString());
        return authCookies.attach(redirect, tokens, null);
    }

    /**
     * 카카오에 보내는 redirect_uri. 카카오 콘솔에 등록한 값과 <b>글자 하나까지</b> 같아야 한다.
     * 공개 base URL 로 만들어야 프록시 뒤에서도 흔들리지 않는다.
     */
    private String callbackUri() {
        return publicUrlResolver.baseUriBuilder().path(CALLBACK_PATH).toUriString();
    }

    private ResponseEntity<Void> toLogin(String reason) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create("/?login_error=" + reason))
                // 실패해도 state 는 버린다 — 남겨 두면 재사용 대상이 된다.
                .header(HttpHeaders.SET_COOKIE, authCookies.clearedOauthState().toString())
                .build();
    }

    private String newState() {
        byte[] bytes = new byte[STATE_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** 비교 시간으로 값을 한 글자씩 맞춰 보는 타이밍 공격을 막는다. */
    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
