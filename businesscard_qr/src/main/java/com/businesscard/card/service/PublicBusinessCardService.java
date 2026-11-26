package com.businesscard.card.service;

import com.businesscard.card.dto.PublicBusinessCardResponse;
import com.businesscard.card.dto.PublicCardPreview;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.support.BusinessCardFinder;
import com.businesscard.common.web.PublicUrlResolver;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공개 명함 보기 — QR·링크를 받은 사람이 로그인 없이 쓰는 경로.
 * 설계: {@code 설계/웹앱_전환_설계.md} §4.
 *
 * <p><b>접근 통제가 다른 세 번째 규칙</b>이라 서비스를 따로 둔다.
 * CRUD 는 "로그인한 소유자만", 토큰 다운로드는 "5분 토큰", 여기는 <b>"UUID 를 아는 사람"</b> 이다.
 * UUID 가 곧 열람 권한(capability)이라서, 한 클래스에 섞어 두면
 * 어느 메서드가 어느 규칙인지 헷갈려 사고가 난다.
 */
@Service
@RequiredArgsConstructor
public class PublicBusinessCardService {

    private final BusinessCardFinder businessCardFinder;
    private final BusinessCardDownloadService downloadService;
    private final PublicUrlResolver publicUrlResolver;

    @Transactional(readOnly = true)
    public PublicBusinessCardResponse getPublicCard(String cardId) {
        BusinessCardEntity card = businessCardFinder.active(cardId);
        return PublicBusinessCardResponse.from(card, imageUrl(card), vcfUrl(cardId));
    }

    /**
     * 링크 미리보기("누구의 명함인지")에 실을 정보. 같은 "UUID 를 아는 사람" 규칙이다 —
     * 링크를 붙여 넣은 대화방의 사람들은 어차피 링크를 열 수 있다.
     * 없거나 지운 명함이면 빈 값 — 미리보기를 만들지 않는다.
     */
    @Transactional(readOnly = true)
    public Optional<PublicCardPreview> findPreview(String cardId) {
        return businessCardFinder.findActive(cardId)
                .map(card -> PublicCardPreview.from(card, imageUrl(card), pageUrl(cardId)));
    }

    /**
     * vCard 파일. 토큰을 요구하지 않는다 — 링크를 받은 사람이 바로 저장할 수 있어야 한다.
     *
     * <p>트랜잭션을 걸지 않는 이유는 {@code BusinessCardDownloadService} 와 같다 —
     * 사진을 읽느라 버킷 GET(외부 I/O)이 일어난다(코드컨벤션 §1).
     */
    public DownloadFile downloadVcf(String cardId) {
        return downloadService.buildVcf(businessCardFinder.active(cardId));
    }

    private String imageUrl(BusinessCardEntity card) {
        String imagePath = card.getBusinessCardImagePath();
        if (imagePath == null || imagePath.isBlank()) {
            return null;
        }
        return publicUrlResolver.baseUriBuilder().path(imagePath).toUriString();
    }

    private String pageUrl(String cardId) {
        return publicUrlResolver.baseUriBuilder().path("/c/").path(cardId).toUriString();
    }

    private String vcfUrl(String cardId) {
        return publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(cardId)
                .path("/public/vcf")
                .toUriString();
    }
}
