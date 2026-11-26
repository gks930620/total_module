package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 웹앱(SPA) 서빙 — 설계 {@code 설계/웹앱_전환_설계.md} §2.
 *
 * <p>브라우저 주소창으로 {@code /cards} 같은 화면 주소에 바로 들어오거나 새로고침하면,
 * 서버는 그 경로의 파일을 모르니 {@code index.html} 을 내주고 React 라우터가 화면을 고른다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-spa",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long"
})
class SpaServingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private AuthService authService;

    @ParameterizedTest
    // /pro/success·/pro/fail — 토스 결제창이 결제 후 돌려보내는 주소(successUrl·failUrl)
    @ValueSource(strings = {"/", "/cards", "/cards/new", "/pro", "/pro/success", "/pro/fail"})
    void appRoutes_forwardToIndexHtml(String route) throws Exception {
        mockMvc.perform(get(route))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void routesWithCardId_forwardToIndexHtml() throws Exception {
        String id = UUID.randomUUID().toString();
        // 공개 명함 /c/{id} 는 미리보기 태그를 채워 내준다 — PublicCardPreviewIntegrationTest 가 본다.
        mockMvc.perform(get("/cards/{id}", id)).andExpect(forwardedUrl("/index.html"));
        mockMvc.perform(get("/cards/{id}/edit", id)).andExpect(forwardedUrl("/index.html"));
    }

    @Test
    void apiPaths_areNotSwallowedBySpaFallback() throws Exception {
        // SPA 폴백이 너무 넓으면 없는 API 가 404 JSON 대신 index.html(200)로 답해
        // 프론트가 "성공"으로 오해한다. API 는 API 답을 해야 한다.
        // 로그인한 요청으로 본다 — 로그인 없이 부르면 라우팅 전에 401 이 나서 이 경로까지 오지도 않는다.
        userRepository.save(UserEntity.builder().id("kakao_spa").provider("kakao").build());
        String token = jwtTokenProvider.createAccessToken("kakao_spa");

        mockMvc.perform(get("/api/no-such-endpoint").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false));
    }

    // ─────────────────────── 캐시 ───────────────────────

    @Test
    void hashedBundles_areCachedForAYear() throws Exception {
        // 번들 이름에는 내용 해시가 붙는다(index-AbC123.js). 내용이 바뀌면 이름이 바뀌니 오래 캐시해도 안전하다.
        // 카톡 인앱 브라우저처럼 서비스워커가 없는 곳에서 명함 링크를 열 때마다 번들을 다시 받지 않게 한다.
        mockMvc.perform(get(firstBundlePath()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("max-age=31536000")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("immutable")));
    }

    @Test
    void indexHtml_isNotCachedLongTerm() throws Exception {
        // index.html 은 "이번 배포의 번들 이름"을 담고 있다. 오래 캐시하면 배포가 반영되지 않는다.
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, not(containsString("immutable"))))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, not(containsString("max-age=31536000"))));
    }

    /** 빌드마다 해시가 바뀌므로 실제 index.html 에서 번들 주소를 읽는다. */
    private String firstBundlePath() throws Exception {
        String indexHtml = new ClassPathResource("static/index.html").getContentAsString(StandardCharsets.UTF_8);
        Matcher matcher = Pattern.compile("src=\"(/assets/[^\"]+\\.js)\"").matcher(indexHtml);
        assertThat(matcher.find()).as("static/index.html 에 /assets/ 번들이 있어야 한다").isTrue();
        return matcher.group(1);
    }

    // ─────────────────────── 보안 헤더 ───────────────────────
    // API 전용 서버일 땐 필요 없었지만, HTML 을 내주는 순간 필요해진다.

    @Test
    void htmlRoutes_carryClickjackingAndSniffingDefenses() throws Exception {
        mockMvc.perform(get("/cards"))
                // 남의 사이트가 우리 화면을 iframe 에 넣고 버튼 위에 투명 레이어를 덮는 공격 차단
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }

    @Test
    void contentSecurityPolicy_allowsOnlyOwnScripts() throws Exception {
        // XSS 가 들어와도 외부 스크립트를 못 불러오고 인라인 스크립트도 못 돌게 한다.
        // 세션 쿠키가 HttpOnly 라 토큰은 못 훔치지만, 스크립트가 돌면 사용자 대신 API 를 부를 수 있다.
        mockMvc.perform(get("/cards"))
                .andExpect(header().string("Content-Security-Policy", containsString("script-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", not(containsString("'unsafe-eval'"))))
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'self'")))
                .andExpect(header().string("Content-Security-Policy", containsString("object-src 'none'")));
    }

    @Test
    void contentSecurityPolicy_letsOnlyTheTossPaymentWindowIn() throws Exception {
        // 결제창: 토스 스크립트를 싣고(script), PC 에선 결제창을 iframe 으로 띄우고(frame),
        // SDK 가 토스 서버와 통신한다(connect). 외부는 정확히 토스 도메인만 연다.
        String csp = "Content-Security-Policy";
        mockMvc.perform(get("/pro"))
                .andExpect(header().string(csp, containsString("script-src 'self' https://js.tosspayments.com;")))
                .andExpect(header().string(csp, containsString("frame-src https://*.tosspayments.com;")))
                .andExpect(header().string(csp, containsString("connect-src 'self' https://*.tosspayments.com;")));
    }

    @Test
    void contentSecurityPolicy_doesNotAllowInlineScripts() throws Exception {
        // script-src 에 'unsafe-inline' 이 섞이면 CSP 가 XSS 를 거의 못 막는다.
        mockMvc.perform(get("/cards"))
                .andExpect(header().string("Content-Security-Policy",
                        not(containsString("script-src 'self' 'unsafe-inline'"))));
    }
}
