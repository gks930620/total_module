package com.doll.gacha.common.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Railway 헬스체크 엔드포인트.
 * - 루트 railway.toml 의 healthcheckPath(/healthz)가 이 URL로 200 응답을 기대한다.
 * - 인증 불필요 (SecurityConfig 에서 permitAll 처리).
 */
@RestController
public class StatusController {

    @GetMapping("/healthz")
    public Map<String, String> healthz() {
        return Map.of(
                "service", "doll_gacha",
                "status", "UP"
        );
    }
}
