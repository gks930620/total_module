package com.businesscard.common.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RailwayDeploymentValidator {

    private static final String LOCAL_DEFAULT_JWT_SECRET = "local-dev-secret-key-change-this-before-production-1234567890";

    @Value("${RAILWAY_PROJECT_ID:}")
    private String railwayProjectId;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

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
    }
}
