package com.doll.gacha.common.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@Transactional
@DisplayName("File Controller 통합 테스트")
class FileControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    private Path testFilePath;

    @BeforeEach
    void setUp() throws IOException {
        // 테스트용 임시 이미지 파일 생성
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);

        testFilePath = uploadPath.resolve("test-image.jpeg");
        // 간단한 JPEG 헤더 (실제 이미지는 아니지만 파일 존재 테스트용)
        byte[] jpegHeader = new byte[]{(byte)0xFF, (byte)0xD8, (byte)0xFF, (byte)0xE0};
        Files.write(testFilePath, jpegHeader);
    }

    @AfterEach
    void tearDown() throws IOException {
        // 테스트 파일 정리
        if (testFilePath != null && Files.exists(testFilePath)) {
            Files.delete(testFilePath);
        }
    }

    @Test
    @DisplayName("파일 조회 - 썸네일만 조회")
    void getFiles_thumbnail() throws Exception {
        // 테스트 환경(H2)에서는 파일 데이터가 없을 수 있으므로 배열만 검사 (ApiResponse.data)
        mockMvc.perform(get("/api/files")
                        .param("refId", "857")
                        .param("refType", "DOLL_SHOP")
                        .param("usage", "THUMBNAIL"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("파일 조회 - 모든 이미지 조회 (usage 없음)")
    void getFiles_allImages() throws Exception {
        mockMvc.perform(get("/api/files")
                        .param("refId", "857")
                        .param("refType", "DOLL_SHOP"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("파일 조회 - IMAGES만 조회")
    void getFiles_contentImages() throws Exception {
        mockMvc.perform(get("/api/files")
                        .param("refId", "857")
                        .param("refType", "DOLL_SHOP")
                        .param("usage", "IMAGES"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("파일 조회 - 존재하지 않는 refId")
    void getFiles_notFound() throws Exception {
        mockMvc.perform(get("/api/files")
                        .param("refId", "999999")
                        .param("refType", "DOLL_SHOP")
                        .param("usage", "THUMBNAIL"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    @DisplayName("파일 조회 - 잘못된 RefType")
    void getFiles_invalidRefType() throws Exception {
        mockMvc.perform(get("/api/files")
                        .param("refId", "857")
                        .param("refType", "INVALID_TYPE")
                        .param("usage", "THUMBNAIL"))
                .andDo(print())
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("파일 서빙 - 실제 이미지 파일")
    void serveFile_success() throws Exception {
        // setUp에서 생성한 테스트 파일로 테스트
        mockMvc.perform(get("/images/test-image.jpeg"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(header().exists("Content-Type"));
    }

    @Test
    @DisplayName("파일 서빙 - 존재하지 않는 파일")
    void serveFile_notFound() throws Exception {
        mockMvc.perform(get("/images/notexist.jpeg"))
                .andDo(print())
                .andExpect(status().isNotFound());
    }
}
