package com.businesscard.billing.repository;

import com.businesscard.billing.entity.WebOrderEntity;
import com.businesscard.billing.entity.WebOrderStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebOrderRepository extends JpaRepository<WebOrderEntity, Long> {

    Optional<WebOrderEntity> findByOrderId(String orderId);

    /** 평생 이용권 보유 여부 — 명함 등록마다 불리는 경로라 행을 읽지 않고 존재만 본다. */
    boolean existsByUserIdAndProductIdAndStatus(String userId, String productId, WebOrderStatus status);
}
