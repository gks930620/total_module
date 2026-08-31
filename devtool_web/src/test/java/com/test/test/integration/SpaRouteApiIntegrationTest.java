package com.test.test.integration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.forwardedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 도구 SPA 라우트 회귀 방지(설계 03 §1, COM-02).
 *
 * <p>직접 접속·새로고침 시에도 각 도구 URL 이 index.html 로 forward 돼야 한다
 * (HomeController + SecurityConfig 화이트리스트 두 곳이 일치해야만 통과).
 *
 * <p>2026-08-04 사업자 진위확인 제거분도 함께 고정한다 — 도구 라우트와 서버 API 가
 * 되살아나면 실패한다.
 */
class SpaRouteApiIntegrationTest extends ApiIntegrationTestSupport {

    @ParameterizedTest
    @ValueSource(strings = {
            "/",
            "/viewer", "/json", "/convert", "/yaml", "/csv", "/json-to-type", "/dummy",
            "/base64", "/jwt", "/hash", "/uuid", "/escape",
            "/regex", "/diff", "/case", "/text", "/unicode",
            "/char-count", "/line-fix", "/list-compare",
            "/image", "/image-privacy", "/image-merge", "/favicon", "/pdf",
            "/timestamp", "/cron", "/number-base", "/bytes", "/color",
            "/url", "/cidr", "/qr",
            "/curl",  "/utm", 
                 
            // 다이어그램
            "/erd", "/class-diagram", "/sequence", "/flowchart", "/state-diagram", "/diagram"
    })
    void 도구_라우트는_index_html_로_forward된다(String path) throws Exception {
        mockMvc.perform(get(path))
                .andExpect(status().isOk())
                .andExpect(forwardedUrl("/index.html"));
    }

    /**
     * 배포 사고 방지: forward 대상인 index.html 이 실제로 패키징돼 있어야 한다.
     *
     * <p>Docker 이미지 빌드에는 node 가 없어 프론트 빌드 태스크가 전부 skip 되고,
     * <b>커밋된 {@code src/main/resources/static} 산출물이 그대로 배포된다.</b>
     * 이게 비어 있으면 빌드는 성공하는데 모든 라우트가 없는 파일로 forward 돼
     * <b>사이트만 조용히 안 뜬다</b>(로그에도 에러가 안 남는다).
     *
     * <p>→ 배포 전 {@code ./gradlew copyFrontendBuild} 를 돌렸는지 여기서 잡는다.
     */
    @Test
    void SPA_산출물이_패키징돼_있다() {
        ClassPathResource index = new ClassPathResource("static/index.html");
        assertThat(index.exists())
                .as("static/index.html 이 없다 — 배포 전 './gradlew copyFrontendBuild' 를 실행할 것 "
                        + "(자세한 절차는 .claude/skills/railway-deploy/SKILL.md §2)")
                .isTrue();
    }

    @Test
    void 제거된_사업자_진위확인_페이지는_차단된다() throws Exception {
        mockMvc.perform(get("/biz-check"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 제거된_사업자_진위확인_프록시_API는_차단된다() throws Exception {
        mockMvc.perform(post("/api/biz-check")
                        .contentType("application/json")
                        .content("{\"bizNo\":\"1208147521\"}"))
                .andExpect(status().isForbidden());
    }
}
