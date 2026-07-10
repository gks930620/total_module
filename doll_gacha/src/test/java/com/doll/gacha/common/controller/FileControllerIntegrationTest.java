package com.doll.gacha.common.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

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

    // 참고: 과거 GET /images/** 서빙 컨트롤러(serveFile)는 제거됨
    // (정적 리소스 static/images/** 를 가려 default-shop.png가 404 나던 문제 수정).
    // 업로드 파일 서빙은 /uploads/**(WebConfig), 이미지는 정적 핸들러가 담당하므로
    // 이 컨트롤러 단위의 서빙 테스트는 더 이상 유효하지 않다.
}
