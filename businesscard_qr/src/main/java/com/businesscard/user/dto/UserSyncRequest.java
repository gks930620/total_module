package com.businesscard.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.user.entity.UserEntity;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UserSyncRequest {

    @NotBlank(message = "id는 필수입니다.")
    private String id;

    private String email;

    private String nickname;

    @JsonProperty("provider")
    private String provider;

    public UserEntity toEntity() {
        return UserEntity.builder()
                .id(id)
                .provider(provider)
                .email(email)
                .nickname(nickname)
                .build();
    }
}
