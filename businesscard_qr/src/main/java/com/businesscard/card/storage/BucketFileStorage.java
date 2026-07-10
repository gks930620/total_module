package com.businesscard.card.storage;

import com.businesscard.common.exception.BusinessRuleException;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/**
 * S3 호환 오브젝트 스토리지(Railway Buckets) 기반 스토리지 (운영 기본값).
 *
 * <p>이미지 바이트를 버킷에 저장하므로 Railway 재배포/재시작에도 파일이 보존된다.
 * 오브젝트 키는 논리 경로에서 {@code /uploads/} 접두사를 제거한 상대 키다(선행 슬래시 없음).
 */
@Slf4j
public class BucketFileStorage implements FileStorage {

    private final S3Client s3;
    private final String bucket;

    public BucketFileStorage(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public String store(String relativeKey, byte[] content, String contentType) {
        String key = normalizeKey(relativeKey);
        try {
            PutObjectRequest.Builder request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key);
            if (contentType != null && !contentType.isBlank()) {
                request.contentType(contentType);
            }
            s3.putObject(request.build(), RequestBody.fromBytes(content));
            return LOGICAL_PREFIX + key;
        } catch (RuntimeException e) {
            log.error("버킷 파일 저장 실패: key={}", key, e);
            throw new BusinessRuleException("이미지 파일 저장에 실패했습니다.");
        }
    }

    @Override
    public Optional<StoredFile> load(String logicalPath) {
        String key = normalizeKey(toRelativeKey(logicalPath));
        try {
            ResponseBytes<GetObjectResponse> object = s3.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build());
            return Optional.of(new StoredFile(object.asByteArray(), object.response().contentType()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (RuntimeException e) {
            log.error("버킷 파일 읽기 실패: key={}", key, e);
            throw new BusinessRuleException("이미지 파일을 읽을 수 없습니다.");
        }
    }

    @Override
    public void delete(String logicalPath) {
        String key = normalizeKey(toRelativeKey(logicalPath));
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (NoSuchKeyException ignored) {
            // 없는 파일 삭제는 조용히 무시한다.
        } catch (RuntimeException e) {
            // 삭제 실패는 치명적이지 않으므로 로그만 남기고 무시한다.
            log.warn("버킷 파일 삭제 실패(무시): key={}", key, e);
        }
    }

    /**
     * 오브젝트 키는 선행 슬래시를 가지면 안 되므로 제거한다.
     */
    private String normalizeKey(String relativeKey) {
        if (relativeKey == null) {
            return null;
        }
        return relativeKey.startsWith("/") ? relativeKey.substring(1) : relativeKey;
    }
}
