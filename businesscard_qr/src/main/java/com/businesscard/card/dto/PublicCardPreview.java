package com.businesscard.card.dto;

import com.businesscard.card.entity.BusinessCardEntity;
import lombok.Builder;
import lombok.Getter;

/**
 * 명함 링크 미리보기(카톡·메신저)에 실리는 정보 — "누구의 명함인지".
 *
 * <p><b>공개 명함 응답보다도 더 좁다.</b> 미리보기는 메신저 회사 서버가 긁어 가서 대화방에 남기고,
 * 명함을 지운 뒤에도 한동안 보일 수 있다. 그래서 이름·직함·회사·명함 사진만 싣고
 * 전화·이메일·주소 같은 연락처 필드는 싣지 않는다(연락처는 링크를 열어야 보인다).
 */
@Getter
@Builder
public class PublicCardPreview {

    private final String fullName;
    private final String title;
    private final String organization;

    /** 명함 사진의 절대 URL. 사진이 없으면 null — 그때는 서비스 대표 이미지를 쓴다. */
    private final String imageUrl;

    /** 이 명함 화면의 절대 URL ({@code /c/{id}}). */
    private final String pageUrl;

    public static PublicCardPreview from(BusinessCardEntity entity, String imageUrl, String pageUrl) {
        return PublicCardPreview.builder()
                .fullName(entity.getFullName())
                .title(entity.getTitle())
                .organization(entity.getOrganization())
                .imageUrl(imageUrl)
                .pageUrl(pageUrl)
                .build();
    }
}
