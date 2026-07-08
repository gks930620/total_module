package com.businesscard.common.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RailwayDeploymentValidator {

    private static final String LOCAL_DEFAULT_JWT_SECRET = "local-dev-secret-key-change-this-before-production-1234567890";

    @Value("${RAILWAY_PROJECT_ID:}")
    private String railwayProjectId;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    @PostConstruct
    void validate() {
        if (railwayProjectId == null || railwayProjectId.isBlank()) {
            return;
        }

        if (LOCAL_DEFAULT_JWT_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException(
                    "Railway deployment requires APP_JWT_SECRET to be set to a non-default value."
            );
        }

        // Railway에서 인메모리 H2로 부팅하면 재배포 때마다 모든 데이터가 사라진다.
        // 반드시 SPRING_DATASOURCE_URL을 Railway MySQL/MariaDB URL로 설정해야 한다.
        if (datasourceUrl == null || datasourceUrl.isBlank() || datasourceUrl.startsWith("jdbc:h2")) {
            throw new IllegalStateException(
                    "Railway 배포에서는 SPRING_DATASOURCE_URL을 Railway MySQL/MariaDB URL로 설정해야 합니다. "
                            + "인메모리 H2로 부팅하면 재배포 시 모든 데이터가 삭제됩니다."
            );
        }

        // 공개 베이스 URL이 없으면 QR/이미지 절대 URL이 X-Forwarded 헤더 추론에 의존한다.
        // 동작은 하지만 프록시 설정 변화에 취약하므로 명시 설정을 권장한다(실패시키지는 않음).
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            log.warn("APP_PUBLIC_BASE_URL이 설정되지 않았습니다. QR/이미지 절대 URL이 X-Forwarded 헤더에 의존하므로 "
                    + "APP_PUBLIC_BASE_URL 설정을 권장합니다.");
        }
    }
}
