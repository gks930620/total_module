package com.doll.gacha.community.dto;

import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityCreateDTO {

    @NotBlank(message = "제목은 필수입니다")
    @Size(max = 200, message = "제목은 200자 이하여야 합니다")
    private String title;

    @NotBlank(message = "내용은 필수입니다")
    private String content;

    /**
     * DTO -> Entity 변환
     */
    public CommunityEntity toEntity(UserEntity user) {
        return CommunityEntity.builder()
                .user(user)
                .title(this.title)
                .content(this.content)
                .viewCount(0)
                .isDeleted(false)
                .build();
    }
}

