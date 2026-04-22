package com.businesscard.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.businesscard.user.entity.UserEntity;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserResponse {

    private String id;
    private String email;
    private String nickname;
    private String provider;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @JsonProperty("updated_at")
    private LocalDateTime updatedAt;

    public static UserResponse from(UserEntity entity) {
        return UserResponse.builder()
                .id(entity.getId())
                .email(entity.getEmail())
                .nickname(entity.getNickname())
                .provider(entity.getProvider())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
