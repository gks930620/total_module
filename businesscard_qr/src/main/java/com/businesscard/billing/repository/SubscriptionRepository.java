package com.businesscard.billing.repository;

import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.businesscard.billing.entity.SubscriptionStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionRepository extends JpaRepository<SubscriptionEntity, Long> {

    /** 영수증으로 기존 구독을 찾는다. 재검증(멱등)과 계정 간 도용 차단에 쓴다. */
    Optional<SubscriptionEntity> findByStoreAndPurchaseToken(Store store, String purchaseToken);

    /**
     * 지금 유효한 구독 중 가장 늦게 끝나는 것 <b>한 건</b>.
     *
     * <p>만료 판정을 DB 에서 하므로(=`expiresAt > now`) 만료된 행을 배치로 정리하지 않아도
     * 프로 판정이 항상 정확하다.
     *
     * <p>{@code First} 를 붙여 DB 에서 1건만 가져온다 — 전부 읽어와 자바에서 첫 개를 고르면
     * 오래 쓴 사용자일수록 읽는 행이 늘어난다(명함 등록마다 호출되는 경로다).
     */
    Optional<SubscriptionEntity> findFirstByUserIdAndStatusInAndExpiresAtAfterOrderByExpiresAtDesc(
            String userId,
            List<SubscriptionStatus> statuses,
            LocalDateTime now
    );
}
