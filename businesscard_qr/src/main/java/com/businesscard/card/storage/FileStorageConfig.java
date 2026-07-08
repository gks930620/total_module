package com.businesscard.card.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 파일 스토리지 구현 선택.
 *
 * <ul>
 *   <li>기본값(또는 {@code app.storage.type=db}) → {@link DbFileStorage}
 *       (Railway MySQL에 저장 → 재배포에도 영구 보존)</li>
 *   <li>{@code app.storage.type=local} → {@link LocalFileStorage}
 *       (로컬 디스크. 개발 편의용)</li>
 * </ul>
 */
@Slf4j
@Configuration
public class FileStorageConfig {

    @Bean
    @ConditionalOnProperty(name = "app.storage.type", havingValue = "local")
    public FileStorage localFileStorage(@Value("${file.upload-dir:./uploads}") String uploadDir) {
        log.info("FileStorage: Local disk (dir={})", uploadDir);
        return new LocalFileStorage(uploadDir);
    }

    @Bean
    @ConditionalOnMissingBean(FileStorage.class)
    public FileStorage dbFileStorage(StoredFileRepository repository) {
        log.info("FileStorage: Database (table=stored_files)");
        return new DbFileStorage(repository);
    }
}
