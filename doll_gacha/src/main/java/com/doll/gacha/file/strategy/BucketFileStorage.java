package com.doll.gacha.file.strategy;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Railway Storage Bucket(S3 호환 오브젝트 스토리지) 파일 저장 전략 — 운영용.
 *
 * <p>app.bucket.endpoint(BUCKET_ENDPOINT)가 설정되면 {@link FileStorageConfig}가 이 구현을 활성화한다.
 * 파일 바이트를 버킷에 저장하므로 Railway 재배포/재시작에도 보존된다.
 * key = 저장 파일명(UUID.ext), 웹 경로 계약(/uploads/저장파일명)은 그대로 유지한다.
 */
@Slf4j
@RequiredArgsConstructor
public class BucketFileStorage implements FileStorageStrategy {

    private final S3Client s3Client;
    private final String bucketName;

    @Override
    public FileUploadResult uploadFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다");
        }

        String originalFilename = file.getOriginalFilename();
        String storedFilename = generateStoredFilename(originalFilename);
        String contentType = file.getContentType();

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(storedFilename)
                    .contentType(contentType)
                    .build();
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException e) {
            log.error("버킷 파일 저장 실패: {}", e.getMessage(), e);
            throw new RuntimeException("파일 저장 실패: " + originalFilename, e);
        }

        log.info("버킷 파일 저장 완료 - 원본: {}, 저장: {}", originalFilename, storedFilename);

        return FileUploadResult.builder()
                .originalFilename(originalFilename)
                .storedFilename(storedFilename)
                .filePath("/uploads/" + storedFilename)  // 웹 경로 (FileController가 버킷에서 서빙)
                .fileSize(file.getSize())
                .contentType(contentType)
                .build();
    }

    @Override
    public Optional<LoadedFile> load(String storedFileName) {
        String key = extractStoredFilename(storedFileName);
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            ResponseBytes<GetObjectResponse> response = s3Client.getObjectAsBytes(request);
            return Optional.of(new LoadedFile(response.asByteArray(), response.response().contentType()));
        } catch (NoSuchKeyException e) {
            log.warn("버킷 파일 없음: {}", key);
            return Optional.empty();
        }
    }

    @Override
    public void deleteFile(String filePath) {
        String key = extractStoredFilename(filePath);
        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            s3Client.deleteObject(request);
            log.info("버킷 파일 삭제 완료: {}", key);
        } catch (RuntimeException e) {
            log.warn("버킷 파일 삭제 실패(무시): {} - {}", key, e.getMessage());
        }
    }

    private String generateStoredFilename(String originalFilename) {
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        return UUID.randomUUID() + extension;
    }

    /** "/uploads/xxx.jpg" 또는 "xxx.jpg" 어느 쪽이 와도 저장 파일명(key)만 추출 */
    private String extractStoredFilename(String filePath) {
        if (filePath == null) {
            return "";
        }
        int lastSlash = filePath.lastIndexOf('/');
        return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
    }
}
