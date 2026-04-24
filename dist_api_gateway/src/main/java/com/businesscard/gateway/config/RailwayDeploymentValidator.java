package com.businesscard.gateway.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RailwayDeploymentValidator {

    @Value("${RAILWAY_PROJECT_ID:}")
    private String railwayProjectId;

    private final GatewayRoutingProperties gatewayRoutingProperties;

    public RailwayDeploymentValidator(GatewayRoutingProperties gatewayRoutingProperties) {
        this.gatewayRoutingProperties = gatewayRoutingProperties;
    }

    @PostConstruct
    void validate() {
        if (railwayProjectId == null || railwayProjectId.isBlank()) {
            return;
        }

        String targetBaseUrl = gatewayRoutingProperties.normalizedTargetBaseUrl().toLowerCase();
        if (targetBaseUrl.startsWith("http://localhost")
                || targetBaseUrl.startsWith("https://localhost")
                || targetBaseUrl.startsWith("http://127.0.0.1")
                || targetBaseUrl.startsWith("https://127.0.0.1")) {
            throw new IllegalStateException(
                    "Railway deployment requires APP_GATEWAY_BUSINESS_QR_URL "
                            + "(or legacy APP_GATEWAY_TARGET_BASE_URL) "
                            + "to point to businesscard_qr service URL."
            );
        }
    }
}
