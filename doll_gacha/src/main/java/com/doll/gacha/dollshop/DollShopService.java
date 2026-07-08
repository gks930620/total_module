package com.doll.gacha.dollshop;

import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.dollshop.dto.DollShopDTO;
import com.doll.gacha.dollshop.dto.DollShopListDTO;
import com.doll.gacha.dollshop.dto.DollShopMapDTO;
import com.doll.gacha.dollshop.dto.DollShopSearchDTO;
import com.doll.gacha.dollshop.repository.DollShopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DollShopService {
    private final DollShopRepository dollShopRepository;
    /**
     * 게시판용 - 통합 검색 메서드 (페이징, N+1 방지)
     * Repository에서 이미지까지 함께 세팅
     * @param searchDTO 검색 조건 (gubun1, gubun2, isOperating, keyword)
     * @param pageable 페이징 정보
     * @return 페이징된 매장 목록
     */
    public Page<DollShopListDTO> searchShopsPaged(DollShopSearchDTO searchDTO, Pageable pageable) {
        // Repository에서 직접 DTO로 조회 (DollShop + 썸네일 이미지 + 리뷰 통계 포함)
        return dollShopRepository.searchByConditions(searchDTO, pageable);
    }

    /**
     * 지도용 - 매장 목록 조회 (MapDTO로 반환, 이미지 제외)
     * @param searchDTO 검색 조건 (gubun1, gubun2)
     * @return 지도용 매장 리스트
     */
    public List<DollShopMapDTO> searchShopsForMap(DollShopSearchDTO searchDTO) {
        // Repository에서 직접 DTO로 조회 (원칙: select시 queryDSL에서 직접 DTO 리턴)
        return dollShopRepository.searchForMap(searchDTO);
    }



    /**
     * 특정 가게 조회 (이미지 제외 - 클라이언트에서 별도 요청)
     */
    public DollShopDTO getById(Long id) {
        return dollShopRepository.findById(id)
            .map(DollShopDTO::from)
            .orElseThrow(() -> EntityNotFoundException.of("가게", id));
    }
}
