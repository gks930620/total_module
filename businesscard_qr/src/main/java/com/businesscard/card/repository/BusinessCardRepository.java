package com.businesscard.card.repository;

import com.businesscard.card.entity.BusinessCardEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessCardRepository extends JpaRepository<BusinessCardEntity, String> {

    /** 명함 목록 페이징 조회 (정렬은 Pageable 의 Sort 로 지정 — 최신 등록순) */
    Page<BusinessCardEntity> findByUserIdAndIsActiveTrue(String userId, Pageable pageable);

    /** 무료 플랜 한도 판정용. 삭제(비활성)된 명함은 한도를 잡아먹지 않는다. */
    long countByUserIdAndIsActiveTrue(String userId);

    /**
     * 회원 탈퇴 시 파기 대상. 비활성(soft delete) 카드도 포함한다 —
     * 탈퇴는 완전 파기이므로 남겨 둘 이유가 없고, 이미지 파일도 같이 지워야 한다.
     */
    List<BusinessCardEntity> findByUserId(String userId);

    void deleteByUserId(String userId);

    Optional<BusinessCardEntity> findByIdAndUserIdAndIsActiveTrue(String id, String userId);

    Optional<BusinessCardEntity> findByIdAndIsActiveTrue(String id);

    /**
     * 조회수를 DB에서 원자적으로 증가시킨다.
     * 엔티티 로드 후 +1 방식은 동시 QR 스캔 시 갱신이 유실될 수 있어 UPDATE 한 방으로 처리한다.
     *
     * @return 갱신된 행 수(활성 카드가 없으면 0)
     */
    @Modifying
    @Query("update BusinessCardEntity c set c.viewCount = c.viewCount + 1 where c.id = :id and c.isActive = true")
    int incrementViewCount(@Param("id") String id);
}
