package com.test.test.community.dto;

import com.test.test.community.CommunityEntity;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityDTO {
    private Long id;
    private Long userId;
    private String username;
    private String nickname;
    private String title;
    private String content;
    private Integer viewCount;
    private Long commentCount;            // 댓글 수
    private List<String> imageUrls;       // 이미지 URL 리스트
    private List<FileInfoDTO> attachments; // 첨부파일 정보 리스트
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommunityDTO from(CommunityEntity entity) {
        return from(entity, List.of(), List.of());
    }

    public static CommunityDTO from(CommunityEntity entity, List<String> imageUrls, List<FileInfoDTO> attachments) {
        if (entity == null) {
            return null;
        }
        return CommunityDTO.builder()
                .id(entity.getId())
                .userId(entity.getUser().getId())
                .username(entity.getUser().getUsername())
                .nickname(entity.getUser().getNickname())
                .title(entity.getTitle())
                .content(entity.getContent())
                .viewCount(entity.getViewCount())
                .commentCount(0L)  // 기본값, 실제 값은 Repository에서 설정
                .imageUrls(imageUrls)
                .attachments(attachments)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    /**
     * 첨부파일 정보 DTO
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FileInfoDTO {
        private Long fileId;
        private String originalFileName;
        private Long fileSize;
        private String downloadUrl;
    }
}

