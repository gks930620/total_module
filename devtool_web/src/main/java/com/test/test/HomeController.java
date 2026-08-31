package com.test.test;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 도구 SPA 진입점. 각 도구는 개별 URL(경로 기반)을 가지며(SEO, 설계 03 §1),
 * 직접 접속·새로고침 시에도 index.html 을 forward 해 React 라우터가 처리한다.
 */
@Controller
public class HomeController {

    // 도구 목록의 단일 출처는 프론트의 lib/tools.js 다. 여기와 SecurityConfig 화이트리스트는
    // 그 목록을 따라가야 하며, 셋의 정합성은 SpaRouteApiIntegrationTest 가 지킨다.
    @GetMapping({
            "/",
            // 데이터 · 포맷
            "/viewer", "/json", "/convert", "/yaml", "/csv", "/json-to-type", "/dummy",
            // 인코딩 · 보안
            "/base64", "/jwt", "/hash", "/uuid", "/escape",
            // 텍스트
            "/regex", "/diff", "/case", "/text", "/unicode",
            "/char-count", "/line-fix", "/list-compare",
            // 이미지 · 문서
            "/image", "/image-privacy", "/image-merge", "/favicon", "/pdf",
            // 계산 · 변환
            "/timestamp", "/cron", "/number-base", "/bytes", "/color",
            // 웹 · 네트워크
            "/url", "/cidr", "/qr",
            "/curl",  "/utm", 
            // 생활 · 업무
                 
            // 다이어그램
            "/erd", "/class-diagram", "/sequence", "/flowchart", "/state-diagram", "/diagram"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
