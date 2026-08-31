package com.test.test.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * API 통합테스트 공통 베이스 — 전체 컨텍스트 + MockMvc + test 프로파일.
 *
 * <p>이 서비스는 DB를 사용하지 않으므로 트랜잭션 롤백(@Transactional)이 없다.
 * 저장 기능이 생기면 JPA 의존성과 함께 다시 붙일 것.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiIntegrationTestSupport {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;
}
