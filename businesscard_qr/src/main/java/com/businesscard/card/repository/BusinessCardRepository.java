package com.businesscard.card.repository;

import com.businesscard.card.entity.BusinessCardEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessCardRepository extends JpaRepository<BusinessCardEntity, String> {

    List<BusinessCardEntity> findByUserIdAndIsActiveTrueOrderByCreatedAtDesc(String userId);

    Optional<BusinessCardEntity> findByIdAndUserIdAndIsActiveTrue(String id, String userId);

    Optional<BusinessCardEntity> findByIdAndIsActiveTrue(String id);
}
