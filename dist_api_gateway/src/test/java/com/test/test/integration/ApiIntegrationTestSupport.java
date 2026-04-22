package com.test.test.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "file.upload-dir=./build/test-uploads",
        "supabase.enabled=false",
        "app.cookie.secure=false"
})
@Transactional
public abstract class ApiIntegrationTestSupport {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    protected record Tokens(String accessToken, String refreshToken) {
    }

    protected Tokens loginDefaultUser() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "gks930620",
                                  "password": "1234"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return new Tokens(root.path("access_token").asText(), root.path("refresh_token").asText());
    }

    protected String bearer(String accessToken) {
        return "Bearer " + accessToken;
    }

    @AfterEach
    void cleanupUploadedFiles() throws Exception {
        Path testUploadRoot = Path.of("build", "test-uploads").toAbsolutePath().normalize();
        if (!Files.exists(testUploadRoot)) {
            return;
        }

        Files.walk(testUploadRoot)
                .sorted(Comparator.reverseOrder())
                .forEach(path -> {
                    if (!path.equals(testUploadRoot)) {
                        try {
                            Files.deleteIfExists(path);
                        } catch (Exception ignored) {
                        }
                    }
                });
    }
}
