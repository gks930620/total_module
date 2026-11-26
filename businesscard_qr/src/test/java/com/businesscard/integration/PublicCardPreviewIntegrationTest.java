package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 공개 명함 링크의 미리보기 — 카톡·메신저에 링크를 붙였을 때 "누구의 명함인지" 보이게 한다.
 *
 * <p>메신저의 미리보기 수집기는 자바스크립트를 실행하지 않는다. 그래서 React 가 그리는 화면이 아니라
 * <b>서버가 내려주는 HTML 의 og 태그</b>를 읽는다. 서버가 {@code /c/{id}} 에 한해 index.html 에
 * 명함 정보를 끼워 넣어 준다.
 *
 * <p>여기 들어가는 값은 <b>사용자가 입력한 값</b>이다 — HTML 이스케이프가 이 기능의 보안 경계다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-preview",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long",
        "app.public-base-url=https://card.example.com"
})
class PublicCardPreviewIntegrationTest {

    private static final String OWNER = "kakao_preview";

    @Autowired
    private MockMvc mockMvc;

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
        userRepository.save(UserEntity.builder().id(OWNER).provider("kakao").build());
    }

    @Test
    void preview_showsWhoseCardItIs() throws Exception {
        String id = saveCard("홍길동", "개발팀장", "(주)예시회사", null);

        String html = page(id, "ko");

        assertThat(html)
                .contains("<meta property=\"og:title\" content=\"홍길동\">")
                .contains("<meta property=\"og:description\" content=\"개발팀장 · (주)예시회사\">")
                .contains("<meta property=\"og:url\" content=\"https://card.example.com/c/" + id + "\">")
                .contains("<title>홍길동 · 개발팀장 · (주)예시회사</title>");
    }

    @Test
    void preview_usesCardImage_whenThereIsOne() throws Exception {
        String id = saveCard("홍길동", null, null, "/uploads/business-card-images/x.png");

        assertThat(page(id, "ko"))
                .contains("<meta property=\"og:image\" content=\"https://card.example.com/uploads/business-card-images/x.png\">");
    }

    @Test
    void preview_fallsBackToBrandImage_withoutCardImage() throws Exception {
        String id = saveCard("홍길동", null, null, null);

        assertThat(page(id, "ko"))
                .contains("<meta property=\"og:image\" content=\"https://card.example.com/icons/og-default.jpg\">");
    }

    @Test
    void preview_escapesUserInput() throws Exception {
        // 이름 칸에 태그를 넣어도 미리보기 HTML 을 깨고 스크립트를 심을 수 없어야 한다.
        String id = saveCard("\"><script>alert(1)</script>", "<img src=x onerror=alert(2)>", null, null);

        String html = page(id, "ko");

        assertThat(html)
                .doesNotContain("<script>alert(1)</script>")
                .doesNotContain("<img src=x onerror=alert(2)>")
                .contains("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    }

    @Test
    void preview_keepsTheAppBootable() throws Exception {
        // 사람이 열면 그대로 웹앱이 떠야 한다 — 미리보기 태그만 더했을 뿐 같은 index.html 이다.
        String id = saveCard("홍길동", null, null, null);

        assertThat(page(id, "ko"))
                .contains("<div id=\"root\"></div>")
                .containsPattern("<script type=\"module\"[^>]*src=\"/assets/");
    }

    @Test
    void preview_isHiddenFromSearchEngines() throws Exception {
        // 명함 링크는 "아는 사람만 본다"가 전제다. 누가 링크를 공개 게시판에 올려도
        // 검색 결과에 명함(연락처·사진)이 뜨면 안 된다.
        String id = saveCard("홍길동", null, null, null);

        mockMvc.perform(get("/c/{id}", id))
                .andExpect(header().string("X-Robots-Tag", containsString("noindex")))
                .andExpect(content().string(containsString("<meta name=\"robots\" content=\"noindex, nofollow\">")));
    }

    @Test
    void preview_isNotCachedStale() throws Exception {
        // 명함을 고치면 다음 공유부터 새 내용이 보여야 한다.
        String id = saveCard("홍길동", null, null, null);

        mockMvc.perform(get("/c/{id}", id))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-cache")));
    }

    @Test
    void siteName_followsLanguage_koreanByDefault() throws Exception {
        String id = saveCard("홍길동", null, null, null);

        assertThat(page(id, "ko")).contains("<meta property=\"og:site_name\" content=\"명함QR\">");
        assertThat(page(id, "en-US")).contains("<meta property=\"og:site_name\" content=\"Businesscard QR\">");
        // 언어를 안 밝히는 미리보기 수집기가 많다. 주 공유 채널(카카오톡)이 한국어라 한국어로 둔다.
        assertThat(page(id, null)).contains("<meta property=\"og:site_name\" content=\"명함QR\">");
    }

    @Test
    void unknownCard_returns404_withoutLeakingAnything() throws Exception {
        MvcResult result = mockMvc.perform(get("/c/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andReturn();

        String html = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        // 웹앱은 그대로 떠서 "명함을 찾을 수 없어요" 화면을 그린다.
        assertThat(html).contains("<div id=\"root\"></div>").doesNotContain("og:title");
    }

    @Test
    void deletedCard_isNotPreviewed() throws Exception {
        String id = saveCard("삭제된사람", null, null, null);
        BusinessCardEntity card = businessCardRepository.findById(id).orElseThrow();
        card.deactivate();
        businessCardRepository.save(card);

        MvcResult result = mockMvc.perform(get("/c/{id}", id))
                .andExpect(status().isNotFound())
                .andReturn();

        assertThat(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain("삭제된사람");
    }

    @Test
    void preview_stillCarriesSecurityHeaders() throws Exception {
        String id = saveCard("홍길동", null, null, null);

        mockMvc.perform(get("/c/{id}", id))
                .andExpect(header().string("Content-Security-Policy", containsString("script-src 'self'")))
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"));
    }

    @Test
    void uploadedImages_areHiddenFromImageSearch() throws Exception {
        // 명함 사진에는 연락처가 그대로 찍혀 있다. 링크가 새도 이미지 검색에 뜨지 않게 한다.
        mockMvc.perform(get("/uploads/business-card-images/none.png"))
                .andExpect(header().string("X-Robots-Tag", containsString("noindex")));
    }

    // ─────────────────────────── helpers ───────────────────────────

    private String page(String id, String acceptLanguage) throws Exception {
        var request = get("/c/{id}", id);
        if (acceptLanguage != null) {
            request.header(HttpHeaders.ACCEPT_LANGUAGE, acceptLanguage);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private String saveCard(String fullName, String title, String organization, String imagePath) {
        String id = UUID.randomUUID().toString();
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(id)
                .userId(OWNER)
                .fullName(fullName)
                .title(title)
                .organization(organization)
                .businessCardImagePath(imagePath)
                .build());
        return id;
    }
}
