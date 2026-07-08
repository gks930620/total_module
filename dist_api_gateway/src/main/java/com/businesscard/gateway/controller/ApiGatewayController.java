package com.businesscard.gateway.controller;

import com.businesscard.gateway.config.GatewayRoutingProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.client5.http.ConnectTimeoutException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.StreamingHttpOutputMessage;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * businesscard_qr로 요청을 중계하는 리버스 프록시.
 *
 * <p>요청/응답 본문을 메모리에 통째로 담지 않고 스트리밍으로 전달한다. 멀티파트 본문도
 * (게이트웨이의 multipart 파서를 끈 상태로) 원본 바이트 그대로 흘려보낸다.
 */
@Slf4j
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
    public void forward(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpMethod method = HttpMethod.valueOf(request.getMethod());

        URI targetUri;
        try {
            targetUri = buildTargetUri(request);
        } catch (IllegalArgumentException ex) {
            log.warn("잘못된 요청 URI를 거절한다: {} (query={}) - {}",
                    request.getRequestURI(), request.getQueryString(), ex.getMessage());
            writeErrorResponse(response, HttpStatus.BAD_REQUEST.value(), "잘못된 요청 주소입니다");
            return;
        }

        HttpHeaders requestHeaders = buildRequestHeaders(request);
        boolean hasBody = hasBody(request);

        try {
            gatewayRestTemplate.execute(
                    targetUri,
                    method,
                    clientRequest -> {
                        clientRequest.getHeaders().putAll(requestHeaders);
                        if (hasBody) {
                            if (clientRequest instanceof StreamingHttpOutputMessage streamingRequest) {
                                // getBody()를 쓰면 본문이 메모리에 버퍼링되므로, 스트리밍 전송을 위해
                                // 반드시 setBody 콜백으로 원본 요청 스트림을 흘려보낸다.
                                streamingRequest.setBody(outputStream ->
                                        StreamUtils.copy(request.getInputStream(), outputStream));
                            } else {
                                StreamUtils.copy(request.getInputStream(), clientRequest.getBody());
                            }
                        }
                    },
                    clientResponse -> {
                        response.setStatus(clientResponse.getStatusCode().value());
                        filterResponseHeaders(clientResponse.getHeaders())
                                .forEach((name, values) -> values.forEach(value -> response.addHeader(name, value)));
                        StreamUtils.copy(clientResponse.getBody(), response.getOutputStream());
                        return null;
                    });
        } catch (ResourceAccessException ex) {
            handleUpstreamFailure(request, response, ex);
        }
    }

    private void handleUpstreamFailure(HttpServletRequest request, HttpServletResponse response,
                                       ResourceAccessException ex) throws IOException {
        if (response.isCommitted()) {
            // 응답이 이미 커밋된(본문 전송 중) 상태라면 상태코드를 바꿀 수 없다. 로그만 남기고 중단한다.
            log.error("업스트림 I/O 오류가 응답 커밋 이후에 발생했다({} {}). 추가 쓰기 없이 중단한다.",
                    request.getMethod(), request.getRequestURI(), ex);
            return;
        }

        int status = resolveUpstreamFailureStatus(ex);
        log.error("업스트림 요청 실패({} {}) -> {} 응답",
                request.getMethod(), request.getRequestURI(), status, ex);
        response.reset();
        writeErrorResponse(response, status, "업스트림 서비스에 연결할 수 없습니다");
    }

    /**
     * 연결 타임아웃/연결 거부 → 502, 응답(소켓) 타임아웃 → 504.
     * hc5의 ConnectTimeoutException은 SocketTimeoutException의 하위 타입이므로 먼저 검사한다.
     */
    private int resolveUpstreamFailureStatus(Throwable ex) {
        Throwable current = ex;
        while (current != null) {
            if (current instanceof ConnectTimeoutException) {
                return HttpStatus.BAD_GATEWAY.value();
            }
            if (current instanceof SocketTimeoutException) {
                return HttpStatus.GATEWAY_TIMEOUT.value();
            }
            Throwable cause = current.getCause();
            current = (cause == current) ? null : cause;
        }
        return HttpStatus.BAD_GATEWAY.value();
    }

    private void writeErrorResponse(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"" + message + "\"}");
    }

    private boolean hasBody(HttpServletRequest request) {
        if (request.getContentLengthLong() > 0) {
            return true;
        }
        String transferEncoding = request.getHeader(HttpHeaders.TRANSFER_ENCODING);
        return transferEncoding != null && !transferEncoding.isBlank();
    }

    URI buildTargetUri(HttpServletRequest request) {
        String baseUrl = gatewayRoutingProperties.normalizedTargetBaseUrl();
        String uri = request.getRequestURI();
        String query = request.getQueryString();
        if (query == null || query.isBlank()) {
            return URI.create(baseUrl + uri);
        }
        try {
            // 행복 경로: 재인코딩 없이 원본 그대로 사용한다(zero-copy).
            return URI.create(baseUrl + uri + "?" + query);
        } catch (IllegalArgumentException ex) {
            // 쿼리에 인코딩되지 않은 예약 문자가 섞인 경우, 쿼리에서 불법인 문자만
            // 관대하게 퍼센트 인코딩해 재시도한다. 그래도 실패하면 호출부에서 400 처리.
            return URI.create(baseUrl + uri + "?" + encodeQueryLeniently(query));
        }
    }

    /**
     * 쿼리스트링에서 불법인 문자(공백, ", <, >, {, }, |, \, ^, `)만 퍼센트 인코딩한다.
     * 기존 % 시퀀스, &, =, ?, + 등은 건드리지 않는다.
     */
    static String encodeQueryLeniently(String query) {
        StringBuilder encoded = new StringBuilder(query.length() + 16);
        for (int i = 0; i < query.length(); i++) {
            char c = query.charAt(i);
            switch (c) {
                case ' ' -> encoded.append("%20");
                case '"' -> encoded.append("%22");
                case '<' -> encoded.append("%3C");
                case '>' -> encoded.append("%3E");
                case '\\' -> encoded.append("%5C");
                case '^' -> encoded.append("%5E");
                case '`' -> encoded.append("%60");
                case '{' -> encoded.append("%7B");
                case '|' -> encoded.append("%7C");
                case '}' -> encoded.append("%7D");
                default -> encoded.append(c);
            }
        }
        return encoded.toString();
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
            if (isHopByHopHeader(name) || HttpHeaders.CONTENT_LENGTH.equalsIgnoreCase(name)) {
                return;
            }
            if (HttpHeaders.LOCATION.equalsIgnoreCase(name)) {
                List<String> rewritten = new ArrayList<>(values.size());
                values.forEach(value -> rewritten.add(rewriteLocation(value)));
                headers.put(name, rewritten);
            } else {
                headers.put(name, new ArrayList<>(values));
            }
        });
        return headers;
    }

    /**
     * 업스트림 내부 주소로 시작하는 절대 Location을 게이트웨이의 외부 오리진으로 바꿔
     * 내부 URL이 클라이언트에 새어 나가지 않게 한다. 상대 경로 Location은 그대로 통과시킨다.
     */
    private String rewriteLocation(String location) {
        if (location == null || location.isEmpty()) {
            return location;
        }
        String upstreamBase = gatewayRoutingProperties.normalizedTargetBaseUrl();
        if (!location.startsWith(upstreamBase)) {
            return location;
        }
        String remainder = location.substring(upstreamBase.length());
        if (!remainder.isEmpty()) {
            char next = remainder.charAt(0);
            if (next != '/' && next != '?' && next != '#') {
                // 예: base=http://host:80 이고 location=http://host:8081/... 같은 오탐 방지
                return location;
            }
        }
        // forward-headers-strategy: framework 덕분에 원 클라이언트가 본 scheme/host를 반영한다.
        String gatewayOrigin = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        return gatewayOrigin + remainder;
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
