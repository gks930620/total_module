package com.businesscard.gateway.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GatewayStatusController {

    // 루트/헬스 응답에는 상태만 노출한다.
    // 업스트림(businesscard_qr) 내부 URL은 인증 없이 공개되는 이 경로로 노출하지 않는다(내부 토폴로지 은닉).
    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of(
                "service", "dist_api_gateway",
                "status", "UP"
        );
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
