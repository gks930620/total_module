package com.businesscard.card.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.card.entity.BusinessCardEntity;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class BusinessCardResponse {

    private String id;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("full_name")
    private String fullName;

    @JsonProperty("display_name")
    private String displayName;

    @JsonProperty("structured_name")
    private String structuredName;

    private String phone;
    private String email;
    private String website;
    private String organization;
    private String title;
    private String address;
    private String note;

    @JsonProperty("vcf_download_url")
    private String vcfDownloadUrl;

    @JsonProperty("business_card_image_url")
    private String businessCardImageUrl;

    @JsonProperty("is_active")
    private boolean isActive;

    @JsonProperty("view_count")
    private int viewCount;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @JsonProperty("updated_at")
    private LocalDateTime updatedAt;

    public static BusinessCardResponse from(
            BusinessCardEntity entity,
            String imageUrl,
            String vcfDownloadUrl
    ) {
        return BusinessCardResponse.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .fullName(entity.getFullName())
                .displayName(entity.getDisplayName())
                .structuredName(entity.getStructuredName())
                .phone(entity.getPhone())
                .email(entity.getEmail())
                .website(entity.getWebsite())
                .organization(entity.getOrganization())
                .title(entity.getTitle())
                .address(entity.getAddress())
                .note(entity.getNote())
                .vcfDownloadUrl(vcfDownloadUrl)
                .businessCardImageUrl(imageUrl)
                .isActive(entity.isActive())
                .viewCount(entity.getViewCount())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
