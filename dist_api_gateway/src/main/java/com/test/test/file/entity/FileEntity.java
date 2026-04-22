package com.test.test.file.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "files")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String originalFileName;

    @Column(nullable = false)
    private String storedFileName;

    @Column(nullable = false)
    private String filePath;

    private Long fileSize;

    private String contentType;

    private Long refId;

    @Enumerated(EnumType.STRING)
    private RefType refType;

    @Column(name = "file_usage")
    @Enumerated(EnumType.STRING)
    private Usage fileUsage;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public enum RefType {
        COMMUNITY,  // 커뮤니티 게시글
        USER        // 사용자 프로필 등
    }

    public enum Usage {
        THUMBNAIL,      // 썸네일/대표 이미지
        IMAGES,        // 본문 내용 이미지
        ATTACHMENT      // 첨부 파일
    }
}
