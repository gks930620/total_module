package com.test.test.common.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 배포/헬스체크용 라이트 엔드포인트. 인증 없이 200 + {"status":"UP"} 반환(설계 §5-4).
 * DB/외부 의존을 타지 않는 순수 liveness 체크 → 콜드스타트/DB 지연 중에도 빠르게 응답.
 */
@RestController
public class HealthController {

    @GetMapping("/healthz")
    public ResponseEntity<Map<String, String>> healthz() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }
}
