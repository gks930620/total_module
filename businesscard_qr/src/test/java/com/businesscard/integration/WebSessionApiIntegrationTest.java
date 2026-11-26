package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.service.AuthService;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 웹(PWA) 채널 계약 — 설계: {@code 설계/웹앱_전환_설계.md}.
 *
 * <p>검증 대상 둘:
 * <ul>
 *   <li>§3 HttpOnly 쿠키 세션 — 웹은 localStorage 에 토큰을 두지 않는다</li>
 *   <li>§4 공개 명함 조회 — QR·링크를 받은 사람이 로그인 없이 보는 경로</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-web",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long",
        // 운영은 HTTPS 라 Secure 가 켜진다. 그 동작까지 여기서 확인한다.
        "app.cookie.secure=true"
})
class WebSessionApiIntegrationTest {

    private static final String TEST_USER_ID = "kakao_800";
    private static final String ACCESS_COOKIE = "bq_access";
    private static final String REFRESH_COOKIE = "bq_refresh";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BusinessCardRepository businessCardRepository;

    @MockBean
    private AuthService authService;

    @BeforeEach
    void setUp() {
        businessCardRepository.deleteAll();
        userRepository.deleteAll();
        userRepository.save(UserEntity.builder()
                .id(TEST_USER_ID)
                .provider("kakao")
                .email("web@example.com")
                .nickname("web")
                .build());
    }

    // ─────────────────────── §3 쿠키 세션 ───────────────────────

    @Test
    void kakaoLogin_setsHttpOnlySameSiteCookies() throws Exception {
        givenLoginIssues("access-jwt", "refresh-jwt");

        MvcResult result = mockMvc.perform(post("/api/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kakaoAccessToken\":\"kakao-token\"}"))
                .andExpect(status().isOk())
                // 본문 계약은 그대로 유지한다 — 앱을 되살릴 길을 막지 않는다.
                .andExpect(jsonPath("$.data.accessToken").value("access-jwt"))
                .andExpect(cookie().value(ACCESS_COOKIE, "access-jwt"))
                .andExpect(cookie().httpOnly(ACCESS_COOKIE, true))
                .andExpect(cookie().secure(ACCESS_COOKIE, true))
                .andExpect(cookie().value(REFRESH_COOKIE, "refresh-jwt"))
                .andExpect(cookie().httpOnly(REFRESH_COOKIE, true))
                .andReturn();

        List<String> setCookies = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);

        // SameSite=Strict 가 이 설계의 CSRF 방어 본체다(설계 §3-2).
        assertThat(setCookies).allSatisfy(value -> assertThat(value).contains("SameSite=Strict"));

        // 장기 토큰이 일반 API 요청마다 따라다니지 않도록 refresh 쿠키의 Path 를 좁힌다.
        assertThat(setCookies)
                .filteredOn(value -> value.startsWith(REFRESH_COOKIE + "="))
                .singleElement()
                .asString()
                .contains("Path=/api/auth");
    }

    @Test
    void protectedApi_acceptsAccessCookie_withoutAuthorizationHeader() throws Exception {
        saveCard("쿠키로조회");

        mockMvc.perform(get("/api/business-cards")
                        .cookie(new Cookie(ACCESS_COOKIE, realAccessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].full_name").value("쿠키로조회"));
    }

    @Test
    void protectedApi_stillAcceptsAuthorizationHeader() throws Exception {
        // 회귀 방지 — 쿠키를 더하면서 헤더 경로를 깨뜨리지 않았는지 본다(설계 §3-3).
        saveCard("헤더로조회");

        mockMvc.perform(get("/api/business-cards")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + realAccessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].full_name").value("헤더로조회"));
    }

    @Test
    void protectedApi_rejectsRefreshTokenInAccessCookie() throws Exception {
        // 수명 14일인 refresh 토큰을 API 키처럼 쓰지 못하게 막는다.
        mockMvc.perform(get("/api/business-cards")
                        .cookie(new Cookie(ACCESS_COOKIE, jwtTokenProvider.createRefreshToken(TEST_USER_ID))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_expiresBothCookies() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(ACCESS_COOKIE, realAccessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andReturn();

        // Max-Age=0 이어야 브라우저가 즉시 지운다.
        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .hasSize(2)
                .allSatisfy(value -> assertThat(value).contains("Max-Age=0"));
    }

    @Test
    void refresh_worksFromCookieAlone_withoutRequestBody() throws Exception {
        given(authService.refresh("refresh-jwt"))
                .willReturn(AuthTokenResponse.bearer("new-access", "new-refresh", 3600L, TEST_USER_ID));

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(REFRESH_COOKIE, "refresh-jwt")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").value("new-access"))
                // 갱신된 토큰으로 쿠키도 다시 심어야 세션이 이어진다.
                .andExpect(cookie().value(ACCESS_COOKIE, "new-access"));
    }

    @Test
    void refresh_withoutCookieOrBody_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────── §4 공개 명함 보기 ───────────────────

    @Test
    void publicCard_isReadableWithoutLogin() throws Exception {
        String cardId = saveCard("공개명함");

        mockMvc.perform(get("/api/business-cards/{cardId}/public", cardId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(cardId))
                .andExpect(jsonPath("$.data.full_name").value("공개명함"))
                .andExpect(jsonPath("$.data.vcf_download_url").value(Matchers.containsString("/public/vcf")));
    }

    @Test
    void publicCard_doesNotLeakOwnerOrTokens() throws Exception {
        // 축소형 응답이어야 한다 — 소유자 id·다운로드 토큰·내부 타임스탬프를 내보내지 않는다(설계 §4-3).
        String cardId = saveCard("축소형확인");

        mockMvc.perform(get("/api/business-cards/{cardId}/public", cardId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user_id").doesNotExist())
                .andExpect(jsonPath("$.data.view_count").doesNotExist())
                .andExpect(jsonPath("$.data.created_at").doesNotExist())
                .andExpect(jsonPath("$.data.updated_at").doesNotExist());
    }

    @Test
    void publicCard_deletedCard_returnsNotFound() throws Exception {
        String cardId = saveCard("삭제된명함");
        BusinessCardEntity card = businessCardRepository.findById(cardId).orElseThrow();
        card.deactivate();
        businessCardRepository.save(card);

        mockMvc.perform(get("/api/business-cards/{cardId}/public", cardId))
                .andExpect(status().isNotFound());
    }

    @Test
    void publicCard_unknownId_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/business-cards/{cardId}/public", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void publicVcf_downloadsWithoutTokenOrLogin() throws Exception {
        // 링크를 받은 사람이 바로 연락처로 저장할 수 있어야 한다 — 5분 토큰을 요구하지 않는다.
        String cardId = saveCard("연락처저장");

        MvcResult result = mockMvc.perform(get("/api/business-cards/{cardId}/public/vcf", cardId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, Matchers.containsString("text/vcard")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, Matchers.containsString("attachment")))
                .andReturn();

        assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .contains("BEGIN:VCARD")
                .contains("FN:연락처저장");
    }

    // ─────────────────────────── helpers ───────────────────────────

    private void givenLoginIssues(String accessToken, String refreshToken) {
        given(authService.loginWithKakaoAccessToken("kakao-token"))
                .willReturn(AuthTokenResponse.bearer(accessToken, refreshToken, 3600L, TEST_USER_ID));
    }

    private String realAccessToken() {
        return jwtTokenProvider.createAccessToken(TEST_USER_ID);
    }

    private String saveCard(String fullName) {
        String cardId = UUID.randomUUID().toString();
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(cardId)
                .userId(TEST_USER_ID)
                .fullName(fullName)
                .phone("010-1234-5678")
                .build());
        return cardId;
    }
}
