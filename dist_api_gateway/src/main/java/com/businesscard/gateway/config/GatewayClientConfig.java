package com.businesscard.gateway.config;

import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.NoOpResponseErrorHandler;
import org.springframework.web.client.RestTemplate;

@Configuration
public class GatewayClientConfig {

    private static final Timeout CONNECT_TIMEOUT = Timeout.ofSeconds(5);
    // Railway 엣지 타임아웃보다 짧게 유지한다(기존 60s → 30s).
    private static final Timeout RESPONSE_TIMEOUT = Timeout.ofSeconds(30);

    @Bean
    public RestTemplate gatewayRestTemplate() {
        PoolingHttpClientConnectionManager connectionManager = PoolingHttpClientConnectionManagerBuilder.create()
                .setMaxConnTotal(100)
                .setMaxConnPerRoute(50)
                .setDefaultConnectionConfig(ConnectionConfig.custom()
                        .setConnectTimeout(CONNECT_TIMEOUT)
                        .setSocketTimeout(RESPONSE_TIMEOUT)
                        .build())
                .build();

        CloseableHttpClient httpClient = HttpClients.custom()
                .setConnectionManager(connectionManager)
                .setDefaultRequestConfig(RequestConfig.custom()
                        .setResponseTimeout(RESPONSE_TIMEOUT)
                        .build())
                // 프록시는 3xx를 클라이언트에 그대로 중계해야 하므로 자동 리다이렉트를 끈다.
                .disableRedirectHandling()
                // 업스트림 Content-Encoding(gzip 등)을 원본 바이트 그대로 통과시키기 위해
                // 클라이언트의 자동 압축/해제를 끈다.
                .disableContentCompression()
                // 프록시가 비멱등 요청을 몰래 재시도하면 안 된다.
                .disableAutomaticRetries()
                .build();

        // HttpComponentsClientHttpRequestFactory는 버퍼링 설정 없이 요청 본문을 스트리밍한다.
        // (컨트롤러에서 StreamingHttpOutputMessage.setBody로 본문을 넘겨야 실제로 스트리밍된다.)
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(httpClient);

        RestTemplate restTemplate = new RestTemplate(factory);
        // 업스트림의 4xx/5xx 응답도 그대로 클라이언트에 중계해야 하므로 에러를 던지지 않는다.
        restTemplate.setErrorHandler(new NoOpResponseErrorHandler());
        return restTemplate;
    }
}
