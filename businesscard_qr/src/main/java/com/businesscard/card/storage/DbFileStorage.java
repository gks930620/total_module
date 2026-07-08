package com.businesscard.card.storage;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;

/**
 * DB(MySQL) 기반 스토리지 (운영 기본값).
 *
 * <p>이미지 바이트를 {@code stored_files} 테이블에 저장하므로 Railway 재배포/재시작에도
 * 파일이 보존된다. 외부 오브젝트 스토리지 없이 Railway MySQL 하나로 영속성을 확보한다.
 */
@RequiredArgsConstructor
public class DbFileStorage implements FileStorage {

    private final StoredFileRepository repository;

    @Override
    @Transactional
    public String store(String relativeKey, byte[] content, String contentType) {
        String logicalPath = LOGICAL_PREFIX + relativeKey;
        repository.findById(logicalPath)
                .ifPresentOrElse(
                        existing -> existing.replace(content, contentType),
                        () -> repository.save(new StoredFileEntity(logicalPath, content, contentType)));
        return logicalPath;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoredFile> load(String logicalPath) {
        return repository.findById(logicalPath)
                .map(entity -> new StoredFile(entity.getData(), entity.getContentType()));
    }

    @Override
    @Transactional
    public void delete(String logicalPath) {
        repository.deleteById(logicalPath);
    }
}
