package com.businesscard.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.user.entity.UserEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UserSyncRequest {

    @NotBlank(message = "id는 필수입니다.")
    @Size(max = 100, message = "id는 100자를 넘을 수 없습니다.")
    private String id;

    @Size(max = 100, message = "email은 100자를 넘을 수 없습니다.")
    private String email;

    @Size(max = 100, message = "nickname은 100자를 넘을 수 없습니다.")
    private String nickname;

    @JsonProperty("provider")
    @Size(max = 30, message = "provider는 30자를 넘을 수 없습니다.")
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
