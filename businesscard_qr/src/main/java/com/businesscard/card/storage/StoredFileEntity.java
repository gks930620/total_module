package com.businesscard.card.storage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * DB(MySQL)에 저장되는 업로드 파일.
 *
 * <p>Railway 컨테이너의 로컬 디스크는 재배포 시 초기화되므로, 이미지 바이트를 DB에 저장해
 * 배포와 무관하게 파일을 보존한다. PK는 논리 경로({@code /uploads/...})다.
 */
@Entity
@Table(name = "stored_files")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoredFileEntity {

    @Id
    @Column(name = "path", length = 500)
    private String path;

    @Lob
    @Column(name = "data", columnDefinition = "LONGBLOB", nullable = false)
    private byte[] data;

    @Column(name = "content_type", length = 150)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public StoredFileEntity(String path, byte[] data, String contentType) {
        this.path = path;
        this.data = data;
        this.contentType = contentType;
    }

    public void replace(byte[] data, String contentType) {
        this.data = data;
        this.contentType = contentType;
    }

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
