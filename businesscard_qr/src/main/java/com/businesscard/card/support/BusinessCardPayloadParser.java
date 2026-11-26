package com.businesscard.card.support;

import com.businesscard.card.dto.BusinessCardUpsertRequest;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.DuplicateResourceException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * multipart 의 {@code payload} 파트를 요청 DTO 로 바꾸고 검증한다.
 *
 * <p>이미지와 같이 오느라 JSON 이 <b>문자열 파트</b>로 들어와서, 컨트롤러의
 * {@code @Valid @RequestBody} 자동 검증을 탈 수 없다. 그 자리를 대신하는 층이다.
 */
@Component
@RequiredArgsConstructor
public class BusinessCardPayloadParser {

    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final BusinessCardRepository businessCardRepository;

    public BusinessCardUpsertRequest parse(String payload) {
        if (payload == null || payload.isBlank()) {
            throw new BusinessRuleException("payload는 필수입니다.");
        }

        BusinessCardUpsertRequest request;
        try {
            request = objectMapper.readValue(payload, BusinessCardUpsertRequest.class);
        } catch (JsonProcessingException e) {
            throw new BusinessRuleException("payload JSON 형식이 올바르지 않습니다.");
        }

        Set<ConstraintViolation<BusinessCardUpsertRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new BusinessRuleException(violations.iterator().next().getMessage());
        }
        return request;
    }

    /**
     * 새 명함의 id 를 정한다.
     *
     * <p>클라이언트가 id 를 주지 않으면 서버가 UUID 를 만든다.
     * 준 경우에는 <b>반드시 UUID 형식</b>이어야 한다 —
     * (1) 이미지 파일명({@code <cardId>_<timestamp>})의 "추측 어려움" 전제를 지키고,
     * (2) 오프라인 우선 클라이언트가 미리 만든 UUID 는 그대로 받아들이기 위해서다.
     *
     * <p>또 이미 있는 id 인지 본다. 엔티티가 assigned id 라서 {@code save()} 가 {@code merge()} 로
     * 동작하는데, 존재하는 id 로 생성하면 PK 충돌 500 이 아니라
     * <b>남의 명함을 조용히 덮어쓴다</b>(소유권 탈취). 그래서 409 로 막는다.
     */
    public String resolveCardId(String requestedId) {
        if (requestedId == null || requestedId.isBlank()) {
            return UUID.randomUUID().toString();
        }

        String cardId;
        try {
            cardId = UUID.fromString(requestedId.trim()).toString();
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("id는 UUID 형식이어야 합니다.");
        }
        if (businessCardRepository.existsById(cardId)) {
            throw DuplicateResourceException.alreadyExists("이미 존재하는 명함 id입니다.");
        }
        return cardId;
    }
}
