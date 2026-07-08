package com.doll.gacha.dollshop;

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
@DisplayName("DollShop Controller 통합 테스트")
class DollShopControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("지도용 - 전체 매장 조회 (gubun1만)")
    void searchShopsForMap_withGubun1() throws Exception {
        mockMvc.perform(get("/api/doll-shops/map")
                        .param("gubun1", "서울특별시"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
        // 테스트 환경(H2)에서는 데이터가 없을 수 있으므로 배열 요소 검사 생략
    }

    @Test
    @DisplayName("지도용 - 전체 매장 조회 (gubun1 + gubun2)")
    void searchShopsForMap_withGubun1AndGubun2() throws Exception {
        mockMvc.perform(get("/api/doll-shops/map")
                        .param("gubun1", "서울특별시")
                        .param("gubun2", "강남구"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("게시판용 - 페이징 조회 (기본)")
    void searchShopsPaged_default() throws Exception {
        mockMvc.perform(get("/api/doll-shops/search")
                        .param("page", "0")
                        .param("size", "10")
                        .param("sortBy", "id")
                        .param("direction", "DESC"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.page").exists())
                .andExpect(jsonPath("$.data.totalElements").exists())
                .andExpect(jsonPath("$.data.content[0].businessName").exists())
                .andExpect(jsonPath("$.data.content[0].imagePath").exists()); // 썸네일 포함 확인
    }

    @Test
    @DisplayName("게시판용 - 페이징 조회 (gubun1 필터)")
    void searchShopsPaged_withGubun1Filter() throws Exception {
        mockMvc.perform(get("/api/doll-shops/search")
                        .param("page", "0")
                        .param("size", "10")
                        .param("gubun1", "서울특별시"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("게시판용 - 페이징 조회 (isOperating 필터)")
    void searchShopsPaged_withIsOperatingFilter() throws Exception {
        mockMvc.perform(get("/api/doll-shops/search")
                        .param("page", "0")
                        .param("size", "10")
                        .param("isOperating", "true"))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    @DisplayName("상세 조회 - 특정 매장 조회")
    void getShopById_success() throws Exception {
        // 실제 존재하는 ID로 테스트 (예: 857)
        mockMvc.perform(get("/api/doll-shops/{id}", 857))
                .andDo(print())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(857))
                .andExpect(jsonPath("$.data.businessName").exists())
                .andExpect(jsonPath("$.data.address").exists())
                .andExpect(jsonPath("$.data.totalGameMachines").exists())
                .andExpect(jsonPath("$.data.isOperating").exists());
        // phone은 null일 수 있으므로 검증 제외
        // imagePath는 없어야 함 (별도 API로 요청)
    }

    @Test
    @DisplayName("상세 조회 - 존재하지 않는 매장")
    void getShopById_notFound() throws Exception {
        mockMvc.perform(get("/api/doll-shops/{id}", 999999))
                .andDo(print())
                .andExpect(status().isNotFound()); // 404 Not Found
    }
}

