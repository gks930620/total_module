package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * 웹 카카오 로그인 — 서버가 OAuth 를 직접 처리한다. 설계 {@code 설계/웹앱_전환_설계.md} §3-4.
 *
 * <p>브라우저에는 키도 토큰도 나가지 않는다. 브라우저는 {@code /authorize} 로 이동만 하고,
 * 돌아온 인가 코드를 서버가 토큰으로 바꾼 뒤 세션 쿠키를 심어 준다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-kakao-web",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long",
        "app.cookie.secure=true",
        "app.kakao.rest-api-key=test-rest-api-key",
        "app.public-base-url=https://card.example.com"
})
class KakaoWebLoginApiIntegrationTest {

    private static final String STATE_COOKIE = "bq_oauth_state";
    private static final String CALLBACK = "https://card.example.com/api/auth/kakao/callback";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    // ─────────────────────────── /authorize ───────────────────────────

    @Test
    void authorize_redirectsToKakaoWithStateAndRegisteredRedirectUri() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/kakao/authorize"))
                .andExpect(status().isFound())
                .andReturn();

        URI location = URI.create(result.getResponse().getHeader(HttpHeaders.LOCATION));
        assertThat(location.getHost()).isEqualTo("kauth.kakao.com");
        assertThat(location.getPath()).isEqualTo("/oauth/authorize");

        Map<String, List<String>> query = UriComponentsBuilder.fromUri(location).build().getQueryParams();
        assertThat(query.get("client_id")).containsExactly("test-rest-api-key");
        assertThat(query.get("response_type")).containsExactly("code");
        // 카카오 콘솔에 등록한 값과 글자 하나까지 같아야 한다 — 공개 base URL 로 만든다.
        assertThat(decode(query.get("redirect_uri").get(0))).isEqualTo(CALLBACK);

        // state 는 추측할 수 없어야 하고, 쿠키에 같은 값이 들어 있어야 콜백에서 대조할 수 있다.
        String state = query.get("state").get(0);
        assertThat(state).hasSizeGreaterThanOrEqualTo(32);
        assertThat(result.getResponse().getCookie(STATE_COOKIE).getValue()).isEqualTo(state);
    }

    @Test
    void authorize_stateCookieIsLax_notStrict() throws Exception {
        // ⚠️ 핵심 회귀 방지. 카카오 → 우리 콜백은 **교차 사이트** 최상위 이동이다.
        // Strict 면 브라우저가 이 쿠키를 콜백에 싣지 않아 state 대조가 항상 실패하고,
        // 로그인이 100% 깨진다. 테스트(MockMvc)는 SameSite 를 무시하므로 헤더 문자열로 직접 확인한다.
        MvcResult result = mockMvc.perform(get("/api/auth/kakao/authorize"))
                .andExpect(cookie().httpOnly(STATE_COOKIE, true))
                .andExpect(cookie().secure(STATE_COOKIE, true))
                .andReturn();

        String setCookie = stateSetCookieHeader(result);
        assertThat(setCookie).contains("SameSite=Lax").doesNotContain("SameSite=Strict");
        // 로그인 한 번 하는 동안만 살면 된다. 오래 두면 남의 state 를 재사용할 여지가 생긴다.
        assertThat(setCookie).containsPattern("Max-Age=([1-9]|[1-9][0-9]|[1-5][0-9]{2}|600);");
    }

    // ─────────────────────────── /callback ───────────────────────────

    @Test
    void callback_withMatchingState_setsSessionAndGoesToCards() throws Exception {
        given(authService.loginWithKakaoCode("auth-code", CALLBACK))
                .willReturn(AuthTokenResponse.bearer("access-jwt", "refresh-jwt", 3600L, "kakao_1"));

        mockMvc.perform(get("/api/auth/kakao/callback")
                        .param("code", "auth-code")
                        .param("state", "same-state-value-0123456789abcdef")
                        .cookie(new Cookie(STATE_COOKIE, "same-state-value-0123456789abcdef")))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "/cards"))
                .andExpect(cookie().value("bq_access", "access-jwt"))
                .andExpect(cookie().value("bq_refresh", "refresh-jwt"))
                // 쓰고 난 state 는 즉시 버린다 — 재사용 차단.
                .andExpect(cookie().maxAge(STATE_COOKIE, 0));
    }

    @Test
    void callback_withMismatchedState_isRejectedBeforeTouchingKakao() throws Exception {
        // 로그인 CSRF — 공격자가 자기 인가 코드를 피해자 브라우저에 밀어 넣어
        // 피해자를 공격자 계정으로 로그인시키는 공격. state 대조가 이걸 막는다.
        mockMvc.perform(get("/api/auth/kakao/callback")
                        .param("code", "attacker-code")
                        .param("state", "attacker-state-0123456789abcdef00")
                        .cookie(new Cookie(STATE_COOKIE, "victim-state-0123456789abcdef0000")))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "/?login_error=invalid_state"))
                .andExpect(cookie().doesNotExist("bq_access"));

        then(authService).should(never()).loginWithKakaoCode(anyString(), anyString());
    }

    @Test
    void callback_withoutStateCookie_isRejected() throws Exception {
        mockMvc.perform(get("/api/auth/kakao/callback")
                        .param("code", "auth-code")
                        .param("state", "some-state-0123456789abcdef000000"))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "/?login_error=invalid_state"));

        then(authService).should(never()).loginWithKakaoCode(anyString(), anyString());
    }

    @Test
    void callback_whenUserCancels_returnsToLoginQuietly() throws Exception {
        // 사용자가 카카오 동의 화면에서 "취소"를 누르면 code 대신 error 가 온다.
        mockMvc.perform(get("/api/auth/kakao/callback")
                        .param("error", "access_denied")
                        .param("state", "same-state-value-0123456789abcdef")
                        .cookie(new Cookie(STATE_COOKIE, "same-state-value-0123456789abcdef")))
                .andExpect(status().isFound())
                .andExpect(header().string(HttpHeaders.LOCATION, "/?login_error=cancelled"));

        then(authService).should(never()).loginWithKakaoCode(any(), any());
    }

    @Test
    void callback_whenKakaoExchangeFails_returnsToLoginWithError() throws Exception {
        given(authService.loginWithKakaoCode(anyString(), anyString()))
                .willThrow(new com.businesscard.common.exception.UnauthorizedException("Invalid kakao token."));

        mockMvc.perform(get("/api/auth/kakao/callback")
                        .param("code", "expired-code")
                        .param("state", "same-state-value-0123456789abcdef")
                        .cookie(new Cookie(STATE_COOKIE, "same-state-value-0123456789abcdef")))
                .andExpect(status().isFound())
                // 브라우저가 이동해 온 요청이라 JSON 에러가 아니라 로그인 화면으로 돌려보낸다.
                .andExpect(header().string(HttpHeaders.LOCATION, "/?login_error=failed"))
                .andExpect(cookie().doesNotExist("bq_access"));
    }

    // ─────────────────────────── helpers ───────────────────────────

    private String stateSetCookieHeader(MvcResult result) {
        return result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(value -> value.startsWith(STATE_COOKIE + "="))
                .findFirst()
                .orElseThrow();
    }

    private String decode(String value) {
        return java.net.URLDecoder.decode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
