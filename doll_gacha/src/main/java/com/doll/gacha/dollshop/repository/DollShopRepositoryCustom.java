package com.doll.gacha.dollshop.repository;

import com.doll.gacha.dollshop.dto.DollShopListDTO;
import com.doll.gacha.dollshop.dto.DollShopMapDTO;
import com.doll.gacha.dollshop.dto.DollShopSearchDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DollShopRepositoryCustom {

    // QueryDSL 동적 쿼리로 검색 (페이징) - 썸네일 이미지 포함
    Page<DollShopListDTO> searchByConditions(DollShopSearchDTO searchDTO, Pageable pageable);

    // 지도용 - 이미지 제외, 페이징 없음, DTO 직접 반환
    List<DollShopMapDTO> searchForMap(DollShopSearchDTO searchDTO);
}
