package com.businesscard;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long"
})
class BusinessCardApplicationTests {

    @Test
    void contextLoads() {
    }
}
