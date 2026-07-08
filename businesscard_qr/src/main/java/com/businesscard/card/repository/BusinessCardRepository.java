package com.businesscard.card.repository;

import com.businesscard.card.entity.BusinessCardEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessCardRepository extends JpaRepository<BusinessCardEntity, String> {

    List<BusinessCardEntity> findByUserIdAndIsActiveTrueOrderByCreatedAtDesc(String userId);

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
