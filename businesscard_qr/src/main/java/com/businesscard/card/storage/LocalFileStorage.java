package com.businesscard.card.storage;

import com.businesscard.common.exception.BusinessRuleException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;

/**
 * 로컬 디스크 기반 스토리지 (개발용).
 *
 * <p>{@code app.storage.type=local} 일 때 사용된다. 운영 기본 구현은 {@code DbFileStorage}이며,
 * 이 구현은 논리 경로 {@code /uploads/...} 를 업로드 디렉터리 하위 물리 경로로 매핑한다.
 */
@Slf4j
public class LocalFileStorage implements FileStorage {

    private final Path uploadRoot;

    public LocalFileStorage(String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public String store(String relativeKey, byte[] content, String contentType) {
        Path target = resolvePhysical(relativeKey);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(new java.io.ByteArrayInputStream(content), target, StandardCopyOption.REPLACE_EXISTING);
            return LOGICAL_PREFIX + relativeKey;
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일 저장에 실패했습니다.");
        }
    }

    @Override
    public Optional<StoredFile> load(String logicalPath) {
        Path path = resolvePhysical(toRelativeKey(logicalPath));
        if (!Files.exists(path)) {
            return Optional.empty();
        }
        try {
            byte[] bytes = Files.readAllBytes(path);
            String contentType = Files.probeContentType(path);
            return Optional.of(new StoredFile(bytes, contentType));
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일을 읽을 수 없습니다.");
        }
    }

    @Override
    public void delete(String logicalPath) {
        Path path = resolvePhysical(toRelativeKey(logicalPath));
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // 삭제 실패는 치명적이지 않으므로 무시한다.
        }
    }

    /**
     * 상대 키를 업로드 루트 하위 물리 경로로 변환한다.
     * 경로 탈출(../)을 방지하기 위해 정규화 후 루트 하위인지 검증한다.
     */
    private Path resolvePhysical(String relativeKey) {
        Path resolved = uploadRoot.resolve(relativeKey).normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw new BusinessRuleException("잘못된 파일 경로입니다.");
        }
        return resolved;
    }
}
