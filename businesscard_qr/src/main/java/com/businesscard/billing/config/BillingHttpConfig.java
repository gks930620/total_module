package com.businesscard.billing.config;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * 스토어(Google/Apple) 호출 전용 HTTP 클라이언트.
 *
 * <p><b>왜 따로 만드나 — 타임아웃 때문이다.</b>
 * {@code RestClient.create()} 의 기본 팩토리는 읽기 타임아웃이 <b>무제한</b>이다.
 * 스토어가 응답을 주지 않으면 그 요청을 처리하던 톰캣 스레드가 영원히 붙잡히고,
 * 몇 건만 겹쳐도 스레드 풀이 말라 <b>결제와 무관한 API 까지 전부 멈춘다.</b>
 * Railway 의 작은 인스턴스에서는 특히 치명적이라 반드시 상한을 둔다.
 *
 * <p>타임아웃이 걸리면 검증기가 {@code StoreUnavailableException}(503)으로 바꿔 던지고,
 * 앱은 "잠시 후 다시" 를 안내한다. 결제는 스토어에 남아 있으므로 재시도하면 복구된다.
 */
@Configuration
public class BillingHttpConfig {

    /** 연결 수립까지. 여기서 오래 걸리면 대개 네트워크 자체가 막힌 것이라 짧게 잡는다. */
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /**
     * 응답 대기. 스토어 API 는 보통 1초 안에 답한다.
     * 앱 쪽 요청 타임아웃(20초)보다 넉넉히 짧아야 앱이 먼저 끊는 일이 없다.
     */
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);

    /**
     * 토스 결제 승인 응답 대기. 승인은 카드사까지 다녀오느라 스토어 조회보다 오래 걸릴 수 있다.
     * 너무 짧으면 "카드사는 승인했는데 우리는 실패로 아는" 일이 잦아진다(재시도·웹훅으로 복구되긴 한다).
     * 웹앱의 요청 타임아웃(35초, frontend/src/lib/http.js)보다는 짧아야 화면이 먼저 끊기지 않는다.
     */
    private static final Duration TOSS_READ_TIMEOUT = Duration.ofSeconds(25);

    @Bean
    public RestClient storeRestClient(RestClient.Builder builder) {
        return builder
                .requestFactory(ClientHttpRequestFactories.get(
                        ClientHttpRequestFactorySettings.DEFAULTS
                                .withConnectTimeout(CONNECT_TIMEOUT)
                                .withReadTimeout(READ_TIMEOUT)))
                .build();
    }

    /**
     * 토스 전용은 JDK HttpClient 로 만든다. 기본(HttpURLConnection)은 <b>POST 에 401 이 오면 응답 본문을 버린다</b>
     * (스트리밍 모드에선 인증 재시도를 못 해 연결을 끊어 버린다) — 그러면 토스의 오류 코드(UNAUTHORIZED_KEY 등)를
     * 읽을 수 없어 "키가 틀렸다"는 운영 로그가 흐려진다. 2026-11 스모크 테스트에서 확인했다.
     */
    @Bean
    public RestClient tossRestClient(RestClient.Builder builder) {
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build());
        factory.setReadTimeout(TOSS_READ_TIMEOUT);
        return builder.requestFactory(factory).build();
    }
}
