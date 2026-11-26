package com.businesscard.billing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Apple 이 서명해 보낸 거래정보(JWS)에서 payload 만 꺼낸다.
 *
 * <p><b>서명 체인을 검증하지 않는 이유 — 이 클래스가 따로 있는 이유이기도 하다.</b>
 * 여기서 읽는 JWS 는 우리가 Apple 서버에 <b>직접 물어봐 TLS 로 받은 응답</b>이고,
 * 그 호출 자체가 우리 API 키(ES256 JWT)로 인증된다. 즉 출처가 이미 보증돼 있다.
 *
 * <p>서명 체인 검증이 <b>반드시 필요한 경우</b>는 따로 있다 — 클라이언트가 건네준 영수증이나
 * App Store Server Notifications 처럼 <b>출처를 신뢰할 수 없는 경로</b>로 들어온 JWS.
 * 그런 입력을 다루게 되면 이 클래스를 그대로 쓰면 안 되고 체인 검증을 붙여야 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppStoreJwsReader {

    private final ObjectMapper objectMapper;

    /**
     * payload 를 JSON 으로 돌려준다. 값이 없거나 형태가 깨졌으면 <b>빈 노드</b>를 준다 —
     * 호출부가 기본값으로 흘러가게 해서, 필드 하나 때문에 검증 전체가 실패하지 않도록 한다.
     */
    public JsonNode readPayload(String jws) {
        if (jws == null || jws.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            String[] parts = jws.split("\\.");
            if (parts.length < 2) {
                return objectMapper.createObjectNode();
            }
            byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
            return objectMapper.readTree(new String(payload, StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.warn("App Store JWS payload 해석 실패: {}", e.getClass().getSimpleName());
            return objectMapper.createObjectNode();
        }
    }
}
