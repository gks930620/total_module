package com.businesscard.gateway.controller;

import com.businesscard.gateway.config.GatewayRoutingProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequiredArgsConstructor
public class ApiGatewayController {

    private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade"
    );

    private final RestTemplate gatewayRestTemplate;
    private final GatewayRoutingProperties gatewayRoutingProperties;

    @RequestMapping(
            value = {
                    "/api/**",
                    "/uploads/**",
                    "/swagger-ui.html",
                    "/swagger-ui/**",
                    "/v3/api-docs/**"
            },
            method = {
                    RequestMethod.GET,
                    RequestMethod.POST,
                    RequestMethod.PUT,
                    RequestMethod.PATCH,
                    RequestMethod.DELETE,
                    RequestMethod.OPTIONS,
                    RequestMethod.HEAD
            }
    )
    public ResponseEntity<byte[]> forward(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body
    ) {
        HttpMethod method = HttpMethod.valueOf(request.getMethod());
        URI targetUri = URI.create(buildTargetUri(request));

        HttpEntity<byte[]> requestEntity = new HttpEntity<>(body, buildRequestHeaders(request));
        ResponseEntity<byte[]> upstream = gatewayRestTemplate.exchange(targetUri, method, requestEntity, byte[].class);

        return ResponseEntity.status(upstream.getStatusCode())
                .headers(filterResponseHeaders(upstream.getHeaders()))
                .body(upstream.getBody());
    }

    private String buildTargetUri(HttpServletRequest request) {
        String baseUrl = gatewayRoutingProperties.normalizedTargetBaseUrl();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        if (query == null || query.isBlank()) {
            return baseUrl + uri;
        }
        return baseUrl + uri + "?" + query;
    }

    private HttpHeaders buildRequestHeaders(HttpServletRequest request) {
        HttpHeaders headers = new HttpHeaders();

        Collections.list(request.getHeaderNames())
                .forEach(headerName -> headers.put(headerName, Collections.list(request.getHeaders(headerName))));

        headers.remove(HttpHeaders.HOST);
        removeHopByHopHeaders(headers);

        String originalHost = request.getHeader(HttpHeaders.HOST);
        if (originalHost != null && !originalHost.isBlank()) {
            headers.set("X-Forwarded-Host", originalHost);
        }
        headers.set("X-Forwarded-Proto", request.getScheme());
        headers.set("X-Forwarded-Port", String.valueOf(request.getServerPort()));

        String remoteAddress = request.getRemoteAddr();
        if (remoteAddress != null && !remoteAddress.isBlank()) {
            String existingForwardedFor = request.getHeader("X-Forwarded-For");
            String forwardedFor = existingForwardedFor == null || existingForwardedFor.isBlank()
                    ? remoteAddress
                    : existingForwardedFor + ", " + remoteAddress;
            headers.set("X-Forwarded-For", forwardedFor);
        }

        return headers;
    }

    private HttpHeaders filterResponseHeaders(HttpHeaders upstreamHeaders) {
        HttpHeaders headers = new HttpHeaders();
        upstreamHeaders.forEach((name, values) -> {
            if (!isHopByHopHeader(name) && !HttpHeaders.CONTENT_LENGTH.equalsIgnoreCase(name)) {
                headers.put(name, new java.util.ArrayList<>(values));
            }
        });
        return headers;
    }

    private void removeHopByHopHeaders(HttpHeaders headers) {
        Set<String> names = new LinkedHashSet<>(headers.keySet());
        names.stream()
                .filter(this::isHopByHopHeader)
                .forEach(headers::remove);
    }

    private boolean isHopByHopHeader(String headerName) {
        return HOP_BY_HOP_HEADERS.contains(headerName.toLowerCase());
    }
}
