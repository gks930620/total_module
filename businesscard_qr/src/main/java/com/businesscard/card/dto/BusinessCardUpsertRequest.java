package com.businesscard.card.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.card.entity.BusinessCardEntity;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@NoArgsConstructor
public class BusinessCardUpsertRequest {

    private String id;

    @JsonProperty("full_name")
    @NotBlank(message = "full_name은 필수입니다.")
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

    public BusinessCardEntity toEntity(String cardId, String userId, String imagePath) {
        return BusinessCardEntity.builder()
                .id(cardId)
                .userId(userId)
                .fullName(fullName)
                .displayName(displayName)
                .structuredName(structuredName)
                .phone(phone)
                .email(email)
                .website(website)
                .organization(organization)
                .title(title)
                .address(address)
                .note(note)
                .businessCardImagePath(imagePath)
                .build();
    }
}
