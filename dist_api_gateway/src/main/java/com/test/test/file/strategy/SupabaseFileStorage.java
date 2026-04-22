package com.test.test.file.strategy;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Supabase Storage 파일 저장 전략
 * - supabase.enabled=true 일 때 활성화
 * - Supabase Storage API로 파일 업로드 → CDN URL 반환
 */
@Component
@Slf4j
@ConditionalOnProperty(name = "supabase.enabled", havingValue = "true")
public class SupabaseFileStorage implements FileStorageStrategy {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.key}")
    private String supabaseKey;

    @Value("${supabase.bucket:uploads}")
    private String bucket;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public FileUploadResult uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다");
        }

        try {
            String originalFilename = file.getOriginalFilename();
            String extension = extractExtension(originalFilename);
            String storedFilename = UUID.randomUUID() + extension;

            // Supabase Storage API 호출
            String uploadUrl = String.format("%s/storage/v1/object/%s/%s",
                    supabaseUrl, bucket, storedFilename);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseKey);
            headers.set("apikey", supabaseKey);
            headers.setContentType(MediaType.parseMediaType(
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream"));

            HttpEntity<byte[]> requestEntity = new HttpEntity<>(file.getBytes(), headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    uploadUrl, HttpMethod.POST, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                // 공개 URL 생성
                String publicUrl = String.format("%s/storage/v1/object/public/%s/%s",
                        supabaseUrl, bucket, storedFilename);

                log.info("Supabase 업로드 성공 - 원본: {}, URL: {}", originalFilename, publicUrl);

                return FileUploadResult.builder()
                        .originalFilename(originalFilename)
                        .storedFilename(storedFilename)
                        .filePath(publicUrl)  // CDN URL 저장
                        .fileSize(file.getSize())
                        .contentType(file.getContentType())
                        .build();
            } else {
                throw new RuntimeException("Supabase 업로드 실패: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Supabase 업로드 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 업로드 실패: " + file.getOriginalFilename(), e);
        }
    }

    @Override
    public void deleteFile(String filePath) {
        if (filePath == null || !filePath.contains(supabaseUrl)) {
            log.warn("Supabase URL이 아니므로 삭제 스킵: {}", filePath);
            return;
        }

        try {
            String filename = filePath.substring(filePath.lastIndexOf("/") + 1);
            String deleteUrl = String.format("%s/storage/v1/object/%s/%s",
                    supabaseUrl, bucket, filename);

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + supabaseKey);
            headers.set("apikey", supabaseKey);

            HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    deleteUrl, HttpMethod.DELETE, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Supabase 파일 삭제 성공: {}", filename);
            } else {
                log.warn("Supabase 파일 삭제 실패: {} - {}", filename, response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Supabase 파일 삭제 실패: {}", e.getMessage(), e);
        }
    }

    private String extractExtension(String filename) {
        if (filename != null && filename.contains(".")) {
            return filename.substring(filename.lastIndexOf("."));
        }
        return "";
    }
}

