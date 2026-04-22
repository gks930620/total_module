package com.test.test.integration;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FileApiIntegrationTest extends ApiIntegrationTestSupport {

    @Test
    void files_paths_api_returns_file_paths() throws Exception {
        mockMvc.perform(get("/api/files/paths")
                        .param("refId", "1")
                        .param("refType", "COMMUNITY")
                        .param("usage", "THUMBNAIL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void files_upload_detail_content_delete_work() throws Exception {
        Tokens tokens = loginDefaultUser();
        String originalFilename = "integration-" + UUID.randomUUID().toString().substring(0, 8) + ".txt";

        MockMultipartFile multipartFile = new MockMultipartFile(
                "files",
                originalFilename,
                MediaType.TEXT_PLAIN_VALUE,
                "integration-file-content".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/files")
                        .file(multipartFile)
                        .param("refId", "1")
                        .param("refType", "COMMUNITY")
                        .param("usage", "ATTACHMENT")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokens.accessToken())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        MvcResult detailResult = mockMvc.perform(get("/api/files")
                        .param("refId", "1")
                        .param("refType", "COMMUNITY")
                        .param("usage", "ATTACHMENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray())
                .andReturn();

        JsonNode detailRoot = objectMapper.readTree(detailResult.getResponse().getContentAsString());
        JsonNode details = detailRoot.path("data");

        Long fileId = null;
        for (JsonNode detail : details) {
            if (originalFilename.equals(detail.path("originalFileName").asText())) {
                fileId = detail.path("fileId").asLong();
                break;
            }
        }
        assertThat(fileId).isNotNull();
        assertThat(fileId).isPositive();

        mockMvc.perform(get("/api/files/{fileId}/content", fileId))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, org.hamcrest.Matchers.containsString("attachment;")));

        mockMvc.perform(delete("/api/files/{fileId}", fileId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokens.accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
