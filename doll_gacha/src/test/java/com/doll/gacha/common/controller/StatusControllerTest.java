package com.doll.gacha.common.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Railway 헬스체크(/healthz) 스모크 테스트.
 * 이 엔드포인트가 200 + {status:UP}을 주지 못하면 Railway가 서비스를 죽이므로 회귀 방지용으로 고정한다.
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
class StatusControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthz_returnsUp() throws Exception {
        mockMvc.perform(get("/healthz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.service").value("doll_gacha"))
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
