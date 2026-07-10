package com.doll.gacha.file.strategy;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Optional;
import java.util.UUID;

/**
 * 로컬 디스크 파일 저장 전략 — 개발(로컬) 폴백.
 *
 * <p>app.bucket.endpoint(BUCKET_ENDPOINT)가 비어 있으면 {@link FileStorageConfig}가 이 구현을 활성화한다.
 * ${file.upload-dir:./uploads} 아래에 저장 파일명(UUID.ext)으로 읽고/쓰고/지운다.
 * 경로 조작(path traversal) 방어를 위해 항상 업로드 루트 하위 경로인지 검사한다.
 */
@Slf4j
public class LocalDiskFileStorage implements FileStorageStrategy {

    private final Path uploadRoot;

    public LocalDiskFileStorage(String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir == null || uploadDir.isBlank() ? "./uploads" : uploadDir)
                .toAbsolutePath().normalize();
    }

    @Override
    public FileUploadResult uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다");
        }

        String originalFilename = file.getOriginalFilename();
        String storedFilename = generateStoredFilename(originalFilename);

        try {
            Files.createDirectories(uploadRoot);
            Path target = resolveWithinRoot(storedFilename);
            Files.write(target, file.getBytes());
        } catch (IOException e) {
            log.error("디스크 파일 저장 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 저장 실패: " + originalFilename, e);
        }

        log.info("디스크 파일 저장 완료 - 원본: {}, 저장: {}", originalFilename, storedFilename);

        return FileUploadResult.builder()
                .originalFilename(originalFilename)
                .storedFilename(storedFilename)
                .filePath("/uploads/" + storedFilename)  // 웹 경로 (FileController가 디스크에서 서빙)
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .build();
    }

    @Override
    public Optional<LoadedFile> load(String storedFileName) {
        String name = extractStoredFilename(storedFileName);
        try {
            Path target = resolveWithinRoot(name);
            if (!Files.exists(target) || !Files.isRegularFile(target)) {
                return Optional.empty();
            }
            byte[] data = Files.readAllBytes(target);
            String contentType = Files.probeContentType(target);
            return Optional.of(new LoadedFile(data, contentType));
        } catch (IllegalArgumentException e) {
            log.warn("잘못된 파일 경로 요청(무시): {}", storedFileName);
            return Optional.empty();
        } catch (IOException e) {
            log.warn("디스크 파일 읽기 실패: {} - {}", name, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public void deleteFile(String filePath) {
        String name = extractStoredFilename(filePath);
        try {
            Path target = resolveWithinRoot(name);
            Files.deleteIfExists(target);
            log.info("디스크 파일 삭제 완료: {}", name);
        } catch (IllegalArgumentException e) {
            log.warn("잘못된 파일 경로 삭제 요청(무시): {}", filePath);
        } catch (IOException e) {
            log.warn("디스크 파일 삭제 실패(무시): {} - {}", name, e.getMessage());
        }
    }

    private String generateStoredFilename(String originalFilename) {
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        return UUID.randomUUID() + extension;
    }

    /** "/uploads/xxx.jpg" 또는 "xxx.jpg" 어느 쪽이 와도 저장 파일명만 추출 */
    private String extractStoredFilename(String filePath) {
        if (filePath == null) {
            return "";
        }
        int lastSlash = filePath.lastIndexOf('/');
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }

    /** 업로드 루트 하위 경로로 해석하고, 루트를 벗어나면 예외 (path traversal 방어) */
    private Path resolveWithinRoot(String storedFilename) {
        Path resolved = uploadRoot.resolve(storedFilename).normalize();
        if (!resolved.startsWith(uploadRoot)) {
            throw new IllegalArgumentException("업로드 경로를 벗어난 파일명: " + storedFilename);
        }
        return resolved;
    }
}
