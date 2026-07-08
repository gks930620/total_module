package com.doll.gacha;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SPA 라우팅 컨트롤러.
 * 브라우저 진입 URL(페이지 경로)은 모두 React 빌드 산출물(index.html)로 forward 하고,
 * 실제 화면 결정은 React Router 가 담당한다. (설계원칙 2)
 *
 * - REST API(/api/**), 정적 리소스(/assets/**, /images/** 등), OAuth 콜백(/login/oauth2/**)은
 *   여기서 처리하지 않는다.
 */
@Controller
public class HomeController {

    private static final String INDEX = "forward:/index.html";

    @GetMapping({
        "/",
        "/map",
        "/login",
        "/signup",
        "/mypage",
        "/custom-oauth2/login/success",
        "/community", "/community/**",
        "/doll-shop", "/doll-shop/**",
        "/review", "/review/**"
    })
    public String spa() {
        return INDEX;
    }
}
