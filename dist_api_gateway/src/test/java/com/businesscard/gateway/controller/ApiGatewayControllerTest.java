package com.businesscard.gateway.controller;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.match.MockRestRequestMatchers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestTemplate;

@SpringBootTest
@AutoConfigureMockMvc
class ApiGatewayControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RestTemplate gatewayRestTemplate;

    private MockRestServiceServer upstream;

    @BeforeEach
    void setUp() {
        upstream = MockRestServiceServer.createServer(gatewayRestTemplate);
    }

    @Test
    void forwardsGetAndReturnsUpstreamResponse() throws Exception {
        upstream.expect(requestTo("http://upstream.test/api/business-cards"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[{\"id\":\"1\"}]", MediaType.APPLICATION_JSON));

        mockMvc.perform(get("/api/business-cards"))
                .andExpect(status().isOk())
                .andExpect(content().string("[{\"id\":\"1\"}]"));

        upstream.verify();
    }

    @Test
    void forwardsPostBodyToUpstream() throws Exception {
        upstream.expect(requestTo("http://upstream.test/api/users/sync"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(MockRestRequestMatchers.content().string("{\"id\":\"kakao_1\"}"))
                .andRespond(withStatus(HttpStatus.CREATED)
                        .body("ok")
                        .contentType(MediaType.TEXT_PLAIN));

        mockMvc.perform(post("/api/users/sync")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"kakao_1\"}"))
                .andExpect(status().isCreated())
                .andExpect(content().string("ok"));

        upstream.verify();
    }

    @Test
    void relaysUpstreamErrorStatus() throws Exception {
        upstream.expect(requestTo("http://upstream.test/api/business-cards"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        mockMvc.perform(get("/api/business-cards"))
                .andExpect(status().isUnauthorized());

        upstream.verify();
    }
}
