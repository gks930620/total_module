package com.doll.gacha.dollshop;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.common.dto.PageResponse;
import com.doll.gacha.dollshop.dto.DollShopDTO;
import com.doll.gacha.dollshop.dto.DollShopListDTO;
import com.doll.gacha.dollshop.dto.DollShopMapDTO;
import com.doll.gacha.dollshop.dto.DollShopSearchDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/doll-shops")
@RequiredArgsConstructor
@Slf4j
public class DollShopController {
    private final DollShopService dollShopService;

    /**
     * 지도용 - 전체 매장 목록 조회 (gubun1, gubun2로 필터링 가능)
     * @param searchDTO 검색 조건 (gubun1, gubun2)
     * @return MapDTO로 필요한 데이터만 반환 (N+1 방지)
     */
    @GetMapping("/map")
    public ResponseEntity<ApiResponse<List<DollShopMapDTO>>> getShopsForMap(
            @ModelAttribute DollShopSearchDTO searchDTO) {

        log.info("지도용 매장 조회 - searchDTO: {}", searchDTO);

        List<DollShopMapDTO> list = dollShopService.searchShopsForMap(searchDTO);
        return ResponseEntity.ok(ApiResponse.success("지도용 매장 목록 조회 성공", list));
    }

    /**
     * 게시판용 - 매장 목록 페이징 조회 (모든 검색 조건 지원)
     * @param searchDTO 검색 조건 (gubun1, gubun2, keyword)
     * @param pageable 페이징 및 정렬 정보 (스프링이 자동으로 바인딩)
     *                 - page: 페이지 번호 (0부터 시작, 기본값: 0)
     *                 - size: 페이지 크기 (기본값: 10)
     *                 - sort: 정렬 기준 (예: sort=id,desc 또는 sort=averageRating,desc&sort=id,desc)
     * @return 페이징된 매장 목록
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<PageResponse<DollShopListDTO>>> searchShops(
            @ModelAttribute DollShopSearchDTO searchDTO,
            Pageable pageable) {

        log.info("매장 검색 - searchDTO: {}, pageable: {}", searchDTO, pageable);

        Page<DollShopListDTO> shops = dollShopService.searchShopsPaged(searchDTO, pageable);
        return ResponseEntity.ok(ApiResponse.success("매장 목록 조회 성공", PageResponse.from(shops)));
    }

    /**
     * ID로 특정 가게 조회
     * 이미지는 클라이언트에서 /api/files/thumbnail?refType=DOLL_SHOP&refId={id} 로 별도 요청
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DollShopDTO>> getShopById(@PathVariable Long id) {
        log.info("매장 상세 조회 - id: {}", id);
        // 미존재 시 서비스가 EntityNotFoundException 을 던지고 GlobalExceptionHandler 가 표준 404 응답 처리
        DollShopDTO shop = dollShopService.getById(id);
        return ResponseEntity.ok(ApiResponse.success("매장 상세 조회 성공", shop));
    }
}
