package com.businesscard.card.support;

import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.EntityNotFoundException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * "명함을 찾아 주고, 없으면 404" 를 한 곳에 모은 것.
 *
 * <p>CRUD 서비스와 다운로드 서비스가 같은 조회 규칙을 써야 하는데, 양쪽에 복사해 두면
 * 한쪽만 고쳐져 <b>소유자 검증이 빠진 경로</b>가 생기기 쉽다. 그래서 한 곳에 둔다.
 */
@Component
@RequiredArgsConstructor
public class BusinessCardFinder {

    private final BusinessCardRepository businessCardRepository;

    /**
     * 내 명함만 가져온다. 남의 명함 id 를 넣으면 404 —
     * "권한 없음(403)" 이 아니라 "없음" 으로 답해 <b>남의 명함 존재 여부조차 알리지 않는다.</b>
     */
    public BusinessCardEntity ownedActive(String userId, String cardId) {
        requireUserId(userId);
        return businessCardRepository.findByIdAndUserIdAndIsActiveTrue(cardId, userId)
                .orElseThrow(() -> EntityNotFoundException.of("명함", cardId));
    }

    /**
     * 소유자를 따지지 않고 활성 명함을 가져온다.
     *
     * <p>QR 을 스캔한 <b>비로그인 방문자</b>가 쓰는 경로(다운로드·조회수)에서만 쓴다.
     * 접근 통제는 호출부의 다운로드 토큰이 담당한다.
     */
    public BusinessCardEntity active(String cardId) {
        return findActive(cardId).orElseThrow(() -> EntityNotFoundException.of("명함", cardId));
    }

    /**
     * {@link #active} 와 같은 규칙이되, 없을 때 예외 대신 빈 값을 준다.
     *
     * <p>API 가 아니라 <b>HTML 화면</b>을 내주는 경로(명함 링크 미리보기)용이다 —
     * 없는 명함이어도 JSON 오류가 아니라 웹앱 화면("명함을 찾을 수 없어요")을 내줘야 한다.
     */
    public Optional<BusinessCardEntity> findActive(String cardId) {
        return businessCardRepository.findByIdAndIsActiveTrue(cardId);
    }

    /** 인증 주체가 비어 있는 채로 도메인 로직에 들어오지 않도록 막는다. */
    public void requireUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessRuleException("Authenticated user id is required.");
        }
    }
}
