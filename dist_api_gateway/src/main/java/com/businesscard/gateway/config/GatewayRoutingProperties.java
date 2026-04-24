package com.businesscard.gateway.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app.gateway")
public class GatewayRoutingProperties {

    private String targetBaseUrl = "http://localhost:8081";

    public String normalizedTargetBaseUrl() {
        String normalized = stripWrappingQuotes(targetBaseUrl);
        if (normalized == null || normalized.isBlank()) {
            return "http://localhost:8081";
        }
        return normalized.endsWith("/")
                ? normalized.substring(0, normalized.length() - 1)
                : normalized;
    }

    private String stripWrappingQuotes(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            boolean wrappedInDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
            boolean wrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
            if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
                return trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }
}
