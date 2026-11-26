package com.businesscard.billing.service;

import com.businesscard.billing.entity.Store;
import com.businesscard.common.exception.StoreUnavailableException;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 스토어별 구현으로 넘겨 주는 라우터. 이 앱에서 유일한 {@link StoreReceiptVerifier} 빈이다.
 *
 * <p>자격증명이 없으면 <b>503 을 던진다. 절대 통과시키지 않는다</b> — 설계 §4-3.
 * "설정이 없으면 승인"으로 만들면 로컬에서 편한 대신 그대로 운영에 나가 결제 우회 구멍이 된다.
 */
@Slf4j
@Service
public class RoutingStoreReceiptVerifier implements StoreReceiptVerifier {

    private final Map<Store, StoreReceiptClient> clients = new EnumMap<>(Store.class);

    public RoutingStoreReceiptVerifier(List<StoreReceiptClient> storeReceiptClients) {
        storeReceiptClients.forEach(client -> clients.put(client.store(), client));

        // 부팅을 막지는 않는다 — 결제를 안 쓰는 기존 배포가 그대로 떠야 하기 때문.
        // 대신 어떤 스토어가 꺼져 있는지 시작 시 분명히 남긴다.
        clients.forEach((store, client) -> {
            if (client.isConfigured()) {
                log.info("Billing: {} 영수증 검증 사용 가능", store);
            } else {
                log.warn("Billing: {} 자격증명 미설정 — 이 스토어의 결제 검증은 503 으로 거부된다", store);
            }
        });
    }

    @Override
    public VerifiedPurchase verify(Store store, String productId, String purchaseToken) {
        StoreReceiptClient client = clients.get(store);
        if (client == null) {
            throw new StoreUnavailableException("지원하지 않는 스토어입니다: " + store);
        }
        if (!client.isConfigured()) {
            throw new StoreUnavailableException("%s 결제 검증 설정이 없습니다.".formatted(store));
        }
        return client.verify(productId, purchaseToken);
    }
}
