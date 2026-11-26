package com.businesscard.integration;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * PWA manifest — 홈 화면에 설치될 때 아이콘 아래 뜨는 이름.
 *
 * <p>앱 이름 규칙(사용자 결정): <b>한국어는 '명함QR', 그 밖의 언어는 'Businesscard QR'</b>.
 * 정적 manifest 는 이름을 하나만 가질 수 있어서 서버가 언어를 보고 만들어 준다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-manifest",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long"
})
class WebManifestIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    void korean_getsKoreanAppName() throws Exception {
        mockMvc.perform(get("/manifest.webmanifest").param("lang", "ko"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("명함QR"))
                .andExpect(jsonPath("$.short_name").value("명함QR"))
                .andExpect(jsonPath("$.lang").value("ko"));
    }

    @Test
    void otherLanguages_getEnglishBrandName() throws Exception {
        for (String lang : new String[]{"en", "ja", "zh", "es", "de"}) {
            mockMvc.perform(get("/manifest.webmanifest").param("lang", lang))
                    .andExpect(jsonPath("$.name").value("Businesscard QR"))
                    .andExpect(jsonPath("$.lang").value(lang));
        }
    }

    @Test
    void withoutLangParam_followsAcceptLanguage() throws Exception {
        // 앱의 언어 설정이 아직 반영되기 전(첫 방문)에는 브라우저 언어를 따른다.
        mockMvc.perform(get("/manifest.webmanifest").header(HttpHeaders.ACCEPT_LANGUAGE, "ko-KR,ko;q=0.9,en;q=0.8"))
                .andExpect(jsonPath("$.name").value("명함QR"));

        mockMvc.perform(get("/manifest.webmanifest").header(HttpHeaders.ACCEPT_LANGUAGE, "ja-JP,ja;q=0.9"))
                .andExpect(jsonPath("$.name").value("Businesscard QR"))
                .andExpect(jsonPath("$.lang").value("ja"));
    }

    @Test
    void unknownLanguage_fallsBackToEnglish_withoutReflectingInput() throws Exception {
        // 지원하지 않는 값을 그대로 되돌려 주지 않는다 — 응답에 남의 입력을 비추지 않는다.
        mockMvc.perform(get("/manifest.webmanifest").param("lang", "xx\"><script>"))
                .andExpect(jsonPath("$.lang").value("en"))
                .andExpect(content().string(not(containsString("<script>"))));
    }

    @Test
    void manifest_isInstallable() throws Exception {
        // 크롬이 "설치 가능"으로 보려면: start_url · display standalone · 192/512 아이콘 · maskable.
        mockMvc.perform(get("/manifest.webmanifest").param("lang", "en"))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("application/manifest+json")))
                .andExpect(jsonPath("$.start_url").value("/cards"))
                .andExpect(jsonPath("$.scope").value("/"))
                .andExpect(jsonPath("$.display").value("standalone"))
                .andExpect(jsonPath("$.icons[*].sizes", hasItem("192x192")))
                .andExpect(jsonPath("$.icons[*].sizes", hasItem("512x512")))
                .andExpect(jsonPath("$.icons[*].purpose", hasItem("maskable")));
    }

    @Test
    void manifest_variesByLanguage_forCaches() throws Exception {
        // 중간 캐시가 한국어 manifest 를 외국인에게 내주지 않게.
        // Vary 는 여러 줄로 온다(CORS 필터가 Origin 을 먼저 붙인다) — 전부 보고 그중에 있는지 확인한다.
        mockMvc.perform(get("/manifest.webmanifest"))
                .andExpect(header().stringValues(HttpHeaders.VARY, hasItem(containsString("Accept-Language"))));
    }
}
