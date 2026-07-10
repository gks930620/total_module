package com.doll.gacha.file.entity;

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
 * DB(MySQL/H2)에 저장되는 업로드 파일의 실제 바이트.
 *
 * <p>Railway 컨테이너 로컬 디스크는 재배포 시 초기화되고, 외부 스토리지(Supabase 등)는 쓰지 않는다.
 * 파일 바이트를 이 테이블(LONGBLOB)에 저장해 Railway MySQL 하나로 영속성을 확보한다.
 * PK는 저장 파일명(storedFileName). 메타데이터는 {@code files} 테이블(FileEntity)이 따로 관리한다
 * (목록 조회 시 바이트를 함께 로딩하지 않도록 분리).
 */
@Entity
@Table(name = "stored_files")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StoredFileEntity {

    @Id
    @Column(name = "stored_file_name", length = 300)
    private String storedFileName;

    @Lob
    @Column(name = "data", columnDefinition = "LONGBLOB", nullable = false)
    private byte[] data;

    @Column(name = "content_type", length = 150)
    private String contentType;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public StoredFileEntity(String storedFileName, byte[] data, String contentType) {
        this.storedFileName = storedFileName;
        this.data = data;
        this.contentType = contentType;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
