package com.test.test.file.strategy;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * 로컬 파일 저장 전략
 * - supabase.enabled=false 일 때 활성화 (기본값)
 * - /uploads/ 디렉토리에 파일 저장
 */
@Component
@Slf4j
@ConditionalOnProperty(name = "supabase.enabled", havingValue = "false", matchIfMissing = true)
public class LocalFileStorage implements FileStorageStrategy {

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    @Override
    public FileUploadResult uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다");
        }

        ensureUploadDirectoryExists();

        try {
            String originalFilename = file.getOriginalFilename();
            String extension = extractExtension(originalFilename);
            String storedFilename = generateUniqueFilename(extension);

            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path filePath = uploadPath.resolve(storedFilename);
            Files.write(filePath, file.getBytes());

            log.info("로컬 파일 저장 완료 - 원본: {}, 저장: {}, 경로: {}", originalFilename, storedFilename, filePath);

            return FileUploadResult.builder()
                    .originalFilename(originalFilename)
                    .storedFilename(storedFilename)
                    .filePath(filePath.toString())
                    .fileSize(file.getSize())
                    .contentType(file.getContentType())
                    .build();

        } catch (IOException e) {
            log.error("파일 저장 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 저장 실패: " + file.getOriginalFilename(), e);
        }
    }

    @Override
    public void deleteFile(String filePath) {
        try {
            Path path = Paths.get(filePath);
            if (Files.exists(path)) {
                Files.delete(path);
                log.info("로컬 파일 삭제 완료: {}", filePath);
            }
        } catch (IOException e) {
            log.error("파일 삭제 실패: {}", e.getMessage(), e);
        }
    }

    private void ensureUploadDirectoryExists() {
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
                log.info("업로드 디렉토리 생성: {}", uploadPath);
            }
        } catch (IOException e) {
            throw new RuntimeException("업로드 디렉토리 생성 실패", e);
        }
    }

    private String extractExtension(String filename) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf("."));
        }
        return "";
    }

    private String generateUniqueFilename(String extension) {
        return UUID.randomUUID() + extension;
    }
}

