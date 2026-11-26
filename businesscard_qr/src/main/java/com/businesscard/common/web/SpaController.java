package com.businesscard.common.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * 웹앱(SPA) 진입점. 설계 {@code 설계/웹앱_전환_설계.md} §2.
 *
 * <p>주소창으로 화면 주소에 바로 들어오거나 새로고침하면 서버는 그 경로의 파일을 모른다.
 * 그때 {@code index.html} 을 내주면 React 라우터가 주소를 보고 화면을 고른다.
 *
 * <p><b>경로를 일일이 적는 이유:</b> {@code /**} 같은 넓은 폴백을 쓰면 없는 API 가
 * 404 JSON 대신 index.html(200)로 답해, 프론트가 실패를 성공으로 오해한다.
 * 화면 경로가 늘면 여기와 프론트의 라우터({@code frontend/src/App.jsx})를 함께 고친다 —
 * 정합성은 {@code SpaServingIntegrationTest} 가 지킨다.
 *
 * <p>공개 명함 {@code /c/{cardId}} 는 여기 없다 — 링크 미리보기 태그를 채워 내줘야 해서
 * {@code PublicCardPageController} 가 맡는다.
 */
@Controller
public class SpaController {

    @GetMapping({
            "/",
            "/cards",
            "/cards/new",
            "/cards/{cardId}",
            "/cards/{cardId}/edit",
            "/pro",
            // 토스 결제창이 결제 후 돌려보내는 주소(successUrl·failUrl) — 설계 웹결제_설계.md
            "/pro/success",
            "/pro/fail"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
