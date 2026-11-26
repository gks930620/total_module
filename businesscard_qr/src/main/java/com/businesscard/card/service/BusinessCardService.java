package com.businesscard.card.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.billing.service.EntitlementService;
import com.businesscard.card.dto.BusinessCardIdResponse;
import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.dto.BusinessCardUpsertRequest;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.card.support.BusinessCardFinder;
import com.businesscard.card.support.BusinessCardPayloadParser;
import com.businesscard.card.support.BusinessCardResponseAssembler;
import com.businesscard.card.support.CardImageStorage;
import com.businesscard.common.dto.PageResponse;
import com.businesscard.common.exception.CardLimitExceededException;
import com.businesscard.common.exception.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 명함 CRUD.
 *
 * <p>주변 일은 각자 자기 자리에 있다 — 조회·소유자 검증은 {@link BusinessCardFinder},
 * payload 해석은 {@link BusinessCardPayloadParser}, 이미지 저장은 {@link CardImageStorage},
 * 응답 URL 조립은 {@link BusinessCardResponseAssembler},
 * 파일 내려받기는 {@link BusinessCardDownloadService}.
 */
@Service
@RequiredArgsConstructor
public class BusinessCardService {

    /** 과도한 size 요청 방어 — 한 번에 이보다 많이 주지 않는다. */
    private static final int MAX_PAGE_SIZE = 100;

    private final BusinessCardRepository businessCardRepository;
    private final BusinessCardFinder businessCardFinder;
    private final BusinessCardPayloadParser payloadParser;
    private final BusinessCardResponseAssembler responseAssembler;
    private final CardImageStorage cardImageStorage;
    private final EntitlementService entitlementService;
    private final BillingProperties billingProperties;

    /**
     * 명함 목록 페이징 조회 (최신 등록순).
     * 앱은 무한스크롤로 페이지를 이어 붙이고, 등록/수정/삭제 후에는 목록 재조회 없이
     * 자체 캐시를 갱신한다 — 목록 API 호출을 최소화하는 전략.
     */
    @Transactional(readOnly = true)
    public PageResponse<BusinessCardResponse> getBusinessCards(String userId, int page, int size) {
        businessCardFinder.requireUserId(userId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<BusinessCardResponse> result = businessCardRepository
                .findByUserIdAndIsActiveTrue(userId, pageable)
                .map(responseAssembler::toResponse);
        return PageResponse.from(result);
    }

    @Transactional(readOnly = true)
    public BusinessCardResponse getBusinessCard(String userId, String cardId) {
        return responseAssembler.toResponse(businessCardFinder.ownedActive(userId, cardId));
    }

    /**
     * 명함 생성.
     *
     * <p>버킷 업로드(외부 네트워크 I/O)를 트랜잭션 안에서 하지 않는다 — 코드컨벤션 §1.
     * 느린 버킷 호출이 DB 커넥션을 붙잡으면 커넥션 풀이 고갈된다. DB 저장은 명시적 save 라
     * 별도 트랜잭션이 필요 없다. (저장 실패 시 업로드된 이미지는 orphan 으로 남지만,
     * 데이터가 사라지는 것보다 안전하다)
     */
    public BusinessCardIdResponse createBusinessCard(String userId, String payload, MultipartFile businessCardImage) {
        businessCardFinder.requireUserId(userId);
        assertWithinCardLimit(userId);

        BusinessCardUpsertRequest request = payloadParser.parse(payload);
        String cardId = payloadParser.resolveCardId(request.getId());

        String imagePath = cardImageStorage.store(cardId, businessCardImage);
        BusinessCardEntity entity = request.toEntity(cardId, userId, imagePath);
        businessCardRepository.save(entity);
        return new BusinessCardIdResponse(entity.getId());
    }

    /**
     * 명함 수정.
     *
     * <p>① 버킷 I/O 는 트랜잭션 밖(코드컨벤션 §1). DB 갱신은 dirty checking 대신 <b>명시적 save</b>.
     * <p>② 이미지 교체 시 <b>새 이미지를 먼저 저장하고, DB 갱신까지 성공한 뒤에</b> 옛 이미지를 지운다.
     * 먼저 지우면 저장/갱신이 실패했을 때 DB 는 롤백돼 옛 경로를 가리키는데 파일은 이미
     * 사라져서 <b>원본이 복구 불가능하게 유실</b>된다.
     */
    public BusinessCardIdResponse updateBusinessCard(
            String userId,
            String cardId,
            String payload,
            MultipartFile businessCardImage
    ) {
        BusinessCardEntity card = businessCardFinder.ownedActive(userId, cardId);
        BusinessCardUpsertRequest request = payloadParser.parse(payload);

        String oldImagePath = card.getBusinessCardImagePath();
        boolean imageReplaced = businessCardImage != null && !businessCardImage.isEmpty();
        String imagePath = imageReplaced
                ? cardImageStorage.store(cardId, businessCardImage) // 새 이미지 먼저 저장
                : oldImagePath;

        card.updateFrom(request, imagePath);
        businessCardRepository.save(card);

        if (imageReplaced) {
            cardImageStorage.deleteIfExists(oldImagePath); // 성공한 뒤에야 옛 이미지 삭제
        }
        return new BusinessCardIdResponse(card.getId());
    }

    @Transactional
    public void deleteBusinessCard(String userId, String cardId) {
        businessCardFinder.ownedActive(userId, cardId).deactivate();
    }

    @Transactional
    public void incrementViewCount(String cardId) {
        // 조회수는 카드를 "본" 사람이 올리는 값이므로 소유자/인증으로 제한하지 않는다.
        // QR을 스캔한 비로그인 방문자도 활성 카드이기만 하면 조회수를 증가시킬 수 있다.
        // 동시 스캔 시 갱신 유실(lost update)이 없도록 DB에서 원자적으로 증가시킨다.
        int updated = businessCardRepository.incrementViewCount(cardId);
        if (updated == 0) {
            throw EntityNotFoundException.of("명함", cardId);
        }
    }

    /**
     * 무료 플랜의 명함 등록 한도를 확인한다. 설계: {@code 설계/인앱결제_설계.md} §1.
     *
     * <p><b>등록(create)에만</b> 건다. 이미 만든 명함은 구독이 끝나도 조회·수정·삭제가 모두 된다 —
     * 결제가 끊겼다고 사용자 데이터를 잠그면 스토어 정책과 신뢰 양쪽에서 문제가 된다.
     */
    private void assertWithinCardLimit(String userId) {
        if (entitlementService.isPro(userId)) {
            return;
        }
        int limit = billingProperties.getFreeCardLimit();
        if (businessCardRepository.countByUserIdAndIsActiveTrue(userId) >= limit) {
            throw new CardLimitExceededException(limit);
        }
    }
}
