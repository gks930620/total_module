package com.doll.gacha.common.config;

import com.doll.gacha.file.strategy.BucketFileStorage;
import com.doll.gacha.file.strategy.FileStorageStrategy;
import com.doll.gacha.file.strategy.LocalDiskFileStorage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

/**
 * 파일 저장 전략 빈 구성.
 *
 * <p>선택 규칙: app.bucket.endpoint(BUCKET_ENDPOINT)가 비어있지 않으면
 * Railway Storage Bucket(S3 호환) → {@link BucketFileStorage},
 * 비어있으면 로컬 디스크 → {@link LocalDiskFileStorage}.
 * FileStorageStrategy 빈은 이 클래스에서 유일하게 생성된다(구현체에는 @Component 없음).
 */
@Configuration
@Slf4j
public class FileStorageConfig {

    @Value("${app.bucket.endpoint:}")
    private String bucketEndpoint;

    @Value("${app.bucket.access-key:}")
    private String bucketAccessKey;

    @Value("${app.bucket.secret-key:}")
    private String bucketSecretKey;

    @Value("${app.bucket.name:}")
    private String bucketName;

    @Value("${app.bucket.region:us-east-1}")
    private String bucketRegion;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    @Bean
    public FileStorageStrategy fileStorageStrategy() {
        if (bucketEndpoint != null && !bucketEndpoint.isBlank()) {
            log.info("[파일저장] Railway Storage Bucket(S3) 사용 - endpoint: {}, bucket: {}, region: {}",
                    bucketEndpoint, bucketName, bucketRegion);
            S3Client s3Client = S3Client.builder()
                    .endpointOverride(URI.create(bucketEndpoint))
                    .region(Region.of(bucketRegion))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(bucketAccessKey, bucketSecretKey)))
                    .forcePathStyle(true)
                    .build();
            return new BucketFileStorage(s3Client, bucketName);
        }

        log.info("[파일저장] 로컬 디스크 폴백 사용 - upload-dir: {}", uploadDir);
        return new LocalDiskFileStorage(uploadDir);
    }
}
