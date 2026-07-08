package com.doll.gacha.common.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Supabase 무료 플랜 활성 상태 유지 스케줄러
 * - 무료 플랜은 7일 비활성 시 일시 중지됨
 * - 일주일에 2번 (일요일, 목요일) 간단한 요청으로 활성 상태 유지
 * - supabase.enabled=true 일 때만 동작
 */
@Component
@Slf4j
@ConditionalOnProperty(name = "supabase.enabled", havingValue = "true")
public class SupabaseHealthCheckScheduler {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.bucket:uploads}")
    private String bucket;

    private final RestClient restClient = RestClient.create();

    /**
     * 일요일 오전 3시에 실행 (서버 부하 적은 시간)
     * cron: 초 분 시 일 월 요일
     * 0 = 일요일, 4 = 목요일
     */
    @Scheduled(cron = "0 0 3 * * 0")  // 매주 일요일 03:00
    public void healthCheckSunday() {
        performHealthCheck("일요일");
    }

    /**
     * 목요일 오전 3시에 실행
     */
    @Scheduled(cron = "0 0 3 * * 4")  // 매주 목요일 03:00
    public void healthCheckThursday() {
        performHealthCheck("목요일");
    }

    /**
     * Supabase Storage에 간단한 목록 조회 요청
     * - 실제 파일 업로드/삭제 없이 API 호출만으로 활성 상태 유지
     * - 실패해도 다른 서비스에 영향 없음 (로그만 남김)
     */
    private void performHealthCheck(String day) {
        log.info("🏥 Supabase Health Check 시작 - {}", day);

        try {
            // Bucket 목록 조회 API 호출 (가장 가벼운 요청)
            String listUrl = String.format("%s/storage/v1/object/list/%s", supabaseUrl, bucket);

            // 빈 검색 조건 (파일 1개만 조회)
            String requestBody = "{\"limit\": 1, \"offset\": 0}";

            // RestClient로 요청 (Fluent API)
            restClient.post()
                    .uri(listUrl)
                    .header("Authorization", "Bearer " + supabaseKey)
                    .header("apikey", supabaseKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();

            log.info("✅ Supabase Health Check 성공 - {}", day);

        } catch (Exception e) {
            // 실패해도 다른 서비스에 영향 없도록 로그만 남김
            log.error("❌ Supabase Health Check 실패 - {} | Error: {}", day, e.getMessage());
        }
    }
}

