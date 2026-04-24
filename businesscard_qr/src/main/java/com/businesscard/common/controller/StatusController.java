package com.businesscard.common.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StatusController {

    @GetMapping("/healthz")
    public Map<String, String> healthz() {
        return Map.of(
                "service", "businesscard_qr",
                "status", "UP"
        );
    }
}
