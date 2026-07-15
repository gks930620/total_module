package com.businesscard.common.config;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RailwayDeploymentValidator {

    private static final String LOCAL_DEFAULT_JWT_SECRET = "local-dev-secret-key-change-this-before-production-1234567890";

    @Value("${RAILWAY_PROJECT_ID:}")
    private String railwayProjectId;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${app.public-base-url:}")
    private String publicBaseUrl;

    @Value("${app.kakao.expected-app-id:}")
    private String kakaoExpectedAppId;

    @Value("${app.bucket.endpoint:}")
    private String bucketEndpoint;

    @Value("${app.bucket.name:}")
    private String bucketName;

    @Value("${app.bucket.access-key:}")
    private String bucketAccessKey;

    @Value("${app.bucket.secret-key:}")
    private String bucketSecretKey;

    @PostConstruct
    void validate() {
        if (railwayProjectId == null || railwayProjectId.isBlank()) {
            return;
        }

        if (LOCAL_DEFAULT_JWT_SECRET.equals(jwtSecret)) {
            throw new IllegalStateException(
                    "Railway deployment requires APP_JWT_SECRET to be set to a non-default value."
            );
        }

        // Railway에서 인메모리 H2로 부팅하면 재배포 때마다 모든 데이터가 사라진다.
        // 반드시 SPRING_DATASOURCE_URL을 Railway MySQL/MariaDB URL로 설정해야 한다.
        if (datasourceUrl == null || datasourceUrl.isBlank() || datasourceUrl.startsWith("jdbc:h2")) {
            throw new IllegalStateException(
                    "Railway 배포에서는 SPRING_DATASOURCE_URL을 Railway MySQL/MariaDB URL로 설정해야 합니다. "
                            + "인메모리 H2로 부팅하면 재배포 시 모든 데이터가 삭제됩니다."
            );
        }

        // Railway에서는 컨테이너 로컬 디스크가 재배포 시 초기화되므로 반드시 오브젝트 스토리지(Railway Bucket)를 연결해야 한다.
        if (bucketEndpoint == null || bucketEndpoint.isBlank()) {
            throw new IllegalStateException(
                    "Railway Bucket 미연결 — BUCKET_ENDPOINT/BUCKET_ACCESS_KEY_ID/BUCKET_SECRET_ACCESS_KEY/BUCKET_NAME 을 서비스에 연결하라. "
                            + "로컬 디스크로 부팅하면 재배포 시 업로드 파일이 모두 삭제됩니다."
            );
        }

        if ((bucketName == null || bucketName.isBlank())
                || (bucketAccessKey == null || bucketAccessKey.isBlank())
                || (bucketSecretKey == null || bucketSecretKey.isBlank())) {
            throw new IllegalStateException(
                    "Railway Bucket 설정 불완전 — BUCKET_ENDPOINT 가 설정되었으나 "
                            + "BUCKET_NAME/BUCKET_ACCESS_KEY_ID/BUCKET_SECRET_ACCESS_KEY 중 일부가 비어있습니다."
            );
        }

        // 카카오 토큰의 "발급 앱" 검증. 이 값이 비어 있으면 AuthService 가 app_id 검증을 건너뛰어,
        // 다른 카카오 앱이 발급한 액세스 토큰으로도 로그인이 통과한다(access token audience confusion).
        // 카카오 회원번호는 앱별로 부여되므로 id 공간이 겹치면 기존 계정으로 로그인될 수 있다 → 운영에서는 필수.
        if (kakaoExpectedAppId == null || kakaoExpectedAppId.isBlank()) {
            throw new IllegalStateException(
                    "Railway 배포에서는 APP_KAKAO_EXPECTED_APP_ID 를 설정해야 합니다. "
                            + "미설정 시 다른 카카오 앱이 발급한 액세스 토큰도 로그인에 통과해 인증 우회가 가능합니다. "
                            + "카카오 개발자 콘솔의 앱 ID(숫자)를 설정하세요."
            );
        }

        // 공개 베이스 URL이 없으면 QR/이미지 절대 URL이 X-Forwarded 헤더 추론에 의존한다.
        // 동작은 하지만 프록시 설정 변화에 취약하므로 명시 설정을 권장한다(실패시키지는 않음).
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            log.warn("APP_PUBLIC_BASE_URL이 설정되지 않았습니다. QR/이미지 절대 URL이 X-Forwarded 헤더에 의존하므로 "
                    + "APP_PUBLIC_BASE_URL 설정을 권장합니다.");
        }
    }
}
