package com.doll.gacha.community.comment.dto;

import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.community.comment.CommentEntity;
import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentCreateDTO {

    @NotNull(message = "게시글 ID는 필수입니다")
    private Long communityId;

    @NotBlank(message = "댓글 내용은 필수입니다")
    private String content;

    public CommentEntity toEntity(CommunityEntity community, UserEntity user) {
        return CommentEntity.builder()
                .community(community)
                .user(user)
                .content(this.content)
                .build();
    }
}
