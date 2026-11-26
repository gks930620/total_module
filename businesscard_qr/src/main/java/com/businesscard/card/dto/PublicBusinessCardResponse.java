package com.businesscard.card.dto;

import com.businesscard.card.entity.BusinessCardEntity;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

/**
 * 공개 명함 보기 응답 — 링크를 받은 사람이 로그인 없이 받는 데이터.
 * 설계: {@code 설계/웹앱_전환_설계.md} §4.
 *
 * <p><b>축소형이다.</b> {@link BusinessCardResponse}(소유자용)와 일부러 분리했다 —
 * 소유자용 DTO 를 그대로 쓰면 나중에 필드가 하나 늘 때마다
 * <b>그게 공개로 새는지 아무도 눈치채지 못한다.</b> 여기 없는 것:
 * 소유자 id, 조회수, 생성·수정 시각, 다운로드 토큰.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PublicBusinessCardResponse {

    private final String id;

    @JsonProperty("full_name")
    private final String fullName;

    private final String phone;
    private final String email;
    private final String website;
    private final String organization;
    private final String title;
    private final String address;
    private final String note;

    @JsonProperty("business_card_image_url")
    private final String businessCardImageUrl;

    /** 연락처로 바로 저장할 수 있는 vCard 주소. 토큰이 필요 없다. */
    @JsonProperty("vcf_download_url")
    private final String vcfDownloadUrl;

    public static PublicBusinessCardResponse from(
            BusinessCardEntity entity,
            String imageUrl,
            String vcfDownloadUrl
    ) {
        return PublicBusinessCardResponse.builder()
                .id(entity.getId())
                .fullName(entity.getFullName())
                .phone(entity.getPhone())
                .email(entity.getEmail())
                .website(entity.getWebsite())
                .organization(entity.getOrganization())
                .title(entity.getTitle())
                .address(entity.getAddress())
                .note(entity.getNote())
                .businessCardImageUrl(imageUrl)
                .vcfDownloadUrl(vcfDownloadUrl)
                .build();
    }
}
