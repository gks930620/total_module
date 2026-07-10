package com.doll.gacha.file.repository;

import com.doll.gacha.file.entity.StoredFileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 업로드 파일 바이트(stored_files) 저장소. PK = storedFileName.
 */
public interface StoredFileRepository extends JpaRepository<StoredFileEntity, String> {
}
