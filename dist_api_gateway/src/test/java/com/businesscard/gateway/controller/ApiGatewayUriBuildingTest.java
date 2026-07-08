package com.businesscard.gateway.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.businesscard.gateway.config.GatewayRoutingProperties;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.client.RestTemplate;

/**
 * 잘못된(인코딩되지 않은) 쿼리스트링에 대한 관대한 재인코딩 로직 단위 테스트 (G4).
 */
class ApiGatewayUriBuildingTest {

    private ApiGatewayController controller() {
        GatewayRoutingProperties properties = new GatewayRoutingProperties();
        properties.setTargetBaseUrl("http://upstream.test");
        return new ApiGatewayController(new RestTemplate(), properties);
    }

    private MockHttpServletRequest request(String uri, String queryString) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setQueryString(queryString);
        return request;
    }

    @Test
    void happyPathUsesRawQueryWithoutReencoding() {
        URI uri = controller().buildTargetUri(request("/api/items", "q=%7Bab%7D&x=1+2&y=a%20b"));
        assertThat(uri.toString()).isEqualTo("http://upstream.test/api/items?q=%7Bab%7D&x=1+2&y=a%20b");
    }

    @Test
    void noQueryString() {
        URI uri = controller().buildTargetUri(request("/api/items", null));
        assertThat(uri.toString()).isEqualTo("http://upstream.test/api/items");
    }

    @Test
    void malformedQueryIsLenientlyEncodedOnRetry() {
        URI uri = controller().buildTargetUri(request("/api/items", "q={a b}|c"));
        assertThat(uri.toString()).isEqualTo("http://upstream.test/api/items?q=%7Ba%20b%7D%7Cc");
    }

    @Test
    void unrecoverableQueryThrowsIllegalArgumentException() {
        // %ZZ는 잘못된 퍼센트 시퀀스 — 관대한 인코딩은 %를 건드리지 않으므로 여전히 실패해야 한다.
        assertThatThrownBy(() -> controller().buildTargetUri(request("/api/items", "q=%ZZ")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void lenientEncoderEncodesOnlyIllegalQueryCharacters() {
        assertThat(ApiGatewayController.encodeQueryLeniently("a=1&b=x y\"<>{}|\\^`&c=%20&d=1+2"))
                .isEqualTo("a=1&b=x%20y%22%3C%3E%7B%7D%7C%5C%5E%60&c=%20&d=1+2");
    }
}
