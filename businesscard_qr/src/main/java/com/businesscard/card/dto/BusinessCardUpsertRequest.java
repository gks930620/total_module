package com.businesscard.card.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.card.entity.BusinessCardEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 명함 등록·수정 요청.
 *
 * <p>길이 제한은 {@link BusinessCardEntity} 의 컬럼 길이와 <b>같은 값으로 맞춰 둔다.</b>
 * 이게 없으면 긴 값이 DB 제약에 걸려 {@code DataIntegrityViolationException} 으로 터지고,
 * 사용자에게는 "입력이 너무 깁니다"(400) 대신 "이미 존재하는 리소스"(409)라는
 * 엉뚱한 응답이 나간다. 검증은 입력단에서 한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@Getter
@NoArgsConstructor
public class BusinessCardUpsertRequest {

    private String id;

    @JsonProperty("full_name")
    @NotBlank(message = "full_name은 필수입니다.")
    @Size(max = 120, message = "full_name은 120자를 넘을 수 없습니다.")
    private String fullName;

    @JsonProperty("structured_name")
    @Size(max = 200, message = "structured_name은 200자를 넘을 수 없습니다.")
    private String structuredName;

    @Size(max = 50, message = "phone은 50자를 넘을 수 없습니다.")
    private String phone;

    @Size(max = 120, message = "email은 120자를 넘을 수 없습니다.")
    private String email;

    @Size(max = 200, message = "website는 200자를 넘을 수 없습니다.")
    private String website;

    @Size(max = 120, message = "organization은 120자를 넘을 수 없습니다.")
    private String organization;

    @Size(max = 120, message = "title은 120자를 넘을 수 없습니다.")
    private String title;

    @Size(max = 300, message = "address는 300자를 넘을 수 없습니다.")
    private String address;

    @Size(max = 500, message = "note는 500자를 넘을 수 없습니다.")
    private String note;

    public BusinessCardEntity toEntity(String cardId, String userId, String imagePath) {
        return BusinessCardEntity.builder()
                .id(cardId)
                .userId(userId)
                .fullName(fullName)
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
