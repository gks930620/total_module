package com.doll.gacha.dollshop.repository;

import com.doll.gacha.dollshop.DollShop;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DollShopRepository extends JpaRepository<DollShop, Long> ,
    DollShopRepositoryCustom {

    // 전체 매장 목록 페이징 조회
    Page<DollShop> findAll(Pageable pageable);

}

