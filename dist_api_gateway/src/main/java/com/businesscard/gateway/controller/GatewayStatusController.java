package com.businesscard.gateway.controller;

import com.businesscard.gateway.config.GatewayRoutingProperties;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class GatewayStatusController {

    private final GatewayRoutingProperties gatewayRoutingProperties;

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of(
                "service", "dist_api_gateway",
                "status", "UP",
                "targetBaseUrl", gatewayRoutingProperties.normalizedTargetBaseUrl()
        );
    }

    @GetMapping("/healthz")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
