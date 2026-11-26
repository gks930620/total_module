package com.businesscard.card.support;

import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.common.web.PublicUrlResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 엔티티 → 응답 DTO. 절대 URL 을 만드는 자리이기도 하다.
 *
 * <p>URL 조립은 "무엇을 저장할까"(서비스)와 다른 관심사다 —
 * 배포 도메인이 바뀌면 여기만 보면 되도록 떼어 뒀다.
 */
@Component
@RequiredArgsConstructor
public class BusinessCardResponseAssembler {

    private final PublicUrlResolver publicUrlResolver;

    public BusinessCardResponse toResponse(BusinessCardEntity entity) {
        return BusinessCardResponse.from(entity, imageUrl(entity), vcfDownloadUrl(entity));
    }

    /** 목록·상세에 인라인으로 띄우는 이미지 주소. 이미지가 없으면 null. */
    private String imageUrl(BusinessCardEntity entity) {
        String imagePath = entity.getBusinessCardImagePath();
        if (imagePath == null || imagePath.isBlank()) {
            return null;
        }
        return publicUrlResolver.baseUriBuilder().path(imagePath).toUriString();
    }

    /**
     * vCard 다운로드 <b>토큰을 받으러 갈</b> 주소다(파일 주소가 아니다).
     * 실제 파일 주소는 그 응답에서 짧은 수명의 토큰과 함께 발급된다.
     */
    private String vcfDownloadUrl(BusinessCardEntity entity) {
        return publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(entity.getId())
                .path("/vcf-download-url")
                .toUriString();
    }
}
