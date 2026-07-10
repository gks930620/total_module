package com.doll.gacha.common.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Railway 배포 시 필수 환경변수/프로파일이 빠진 채로 기동되는 것을 막는 fail-fast 검증기.
 * - 환경변수 RAILWAY_PROJECT_ID 가 존재할 때(=Railway 컨테이너)만 동작한다.
 * - 로컬 개발에는 아무 영향 없음.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RailwayDeploymentValidator {

    private final Environment environment;

    @Value("${RAILWAY_PROJECT_ID:}")
    private String railwayProjectId;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @Value("${KAKAO_CLIENT_ID:}")
    private String kakaoClientId;

    @Value("${GOOGLE_CLIENT_ID:}")
    private String googleClientId;

    @Value("${APP_BASE_URL:}")
    private String appBaseUrl;

    @Value("${app.bucket.endpoint:}")
    private String bucketEndpoint;

    @Value("${app.bucket.access-key:}")
    private String bucketAccessKey;

    @Value("${app.bucket.secret-key:}")
    private String bucketSecretKey;

    @Value("${app.bucket.name:}")
    private String bucketName;

    @PostConstruct
    void validate() {
        if (railwayProjectId == null || railwayProjectId.isBlank()) {
            return; // Railway 환경이 아님 (로컬/테스트) → 검증 생략
        }

        // 1. prod 프로파일 필수 — 로컬 기본값(H2 파일, secure=false 쿠키, 시드 SQL)으로
        //    Railway 에서 기동되는 사고 방지
        boolean prodActive = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!prodActive) {
            throw new IllegalStateException(
                    "[Railway] prod 프로파일이 활성화되지 않았습니다. "
                            + "Railway 서비스 환경변수에 SPRING_PROFILES_ACTIVE=prod 를 설정하세요. "
                            + "(현재 활성 프로파일: " + String.join(",", environment.getActiveProfiles()) + ")");
        }

        // 2. 데이터소스 검증 — 컨테이너 디스크는 휘발성이므로 H2/localhost DB 로 뜨면
        //    재배포 때마다 데이터가 전부 사라진다
        if (datasourceUrl == null || datasourceUrl.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] spring.datasource.url 이 비어 있습니다. "
                            + "SPRING_DATASOURCE_URL 또는 MYSQLHOST/MYSQLPORT/MYSQLDATABASE 환경변수를 설정하세요.");
        }
        if (datasourceUrl.startsWith("jdbc:h2")
                || datasourceUrl.contains("localhost")
                || datasourceUrl.contains("127.0.0.1")) {
            throw new IllegalStateException(
                    "[Railway] spring.datasource.url 이 로컬 DB(" + safeUrl(datasourceUrl) + ")를 가리킵니다. "
                            + "SPRING_DATASOURCE_URL 을 Railway MySQL URL로 설정하거나 "
                            + "MYSQLHOST/MYSQLPORT/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD 참조 변수를 연결하세요.");
        }

        // 3. JWT 시크릿 — 미설정이면 토큰 발급/검증 불가
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] JWT 시크릿이 비어 있습니다. 환경변수 JWT_SECRET_KEY 를 설정하세요.");
        }

        // 4. OAuth2 클라이언트 — 미설정이면 소셜 로그인 전부 불가
        if (kakaoClientId == null || kakaoClientId.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] 카카오 OAuth2 클라이언트가 비어 있습니다. "
                            + "환경변수 KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET 을 설정하세요.");
        }
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] 구글 OAuth2 클라이언트가 비어 있습니다. "
                            + "환경변수 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 을 설정하세요.");
        }

        // 6. OAuth2 redirect_uri 베이스 URL — 로컬 기본값(http://localhost:8080)이 그대로면
        //    소셜 로그인 콜백이 localhost 로 향해서 전부 실패한다
        if (appBaseUrl == null || appBaseUrl.isBlank()
                || appBaseUrl.contains("localhost") || appBaseUrl.contains("127.0.0.1")) {
            throw new IllegalStateException(
                    "[Railway] APP_BASE_URL 이 설정되지 않았거나 localhost 기본값입니다. "
                            + "환경변수 APP_BASE_URL 을 공개 도메인(예: https://<service>.up.railway.app)으로 설정하세요.");
        }

        // 7. 파일 스토리지(Railway Storage Bucket, S3 호환) — 컨테이너 디스크는 휘발성이므로
        //    운영에서는 반드시 버킷을 써야 업로드 파일이 재배포 후에도 보존된다
        if (bucketEndpoint == null || bucketEndpoint.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] 파일 스토리지 버킷 endpoint 가 비어 있습니다. "
                            + "컨테이너 디스크는 재배포 시 초기화되므로 Railway Storage Bucket 연결이 필요합니다. "
                            + "환경변수 BUCKET_ENDPOINT / BUCKET_ACCESS_KEY_ID / BUCKET_SECRET_ACCESS_KEY / BUCKET_NAME 을 설정하세요.");
        }
        if (bucketName == null || bucketName.isBlank()
                || bucketAccessKey == null || bucketAccessKey.isBlank()
                || bucketSecretKey == null || bucketSecretKey.isBlank()) {
            throw new IllegalStateException(
                    "[Railway] 파일 스토리지 버킷 endpoint 는 설정되었으나 이름/자격증명이 비어 있습니다. "
                            + "환경변수 BUCKET_NAME / BUCKET_ACCESS_KEY_ID / BUCKET_SECRET_ACCESS_KEY 를 설정하세요.");
        }

        log.info("[Railway] 배포 환경 검증 통과 - prod 프로파일, MySQL 데이터소스, JWT/OAuth2/APP_BASE_URL, 스토리지 버킷 설정 확인 완료");
    }

    /** 비밀번호가 URL 에 포함될 수 있으므로 호스트 부분만 로그에 남긴다 */
    private String safeUrl(String url) {
        int queryIdx = url.indexOf('?');
        return queryIdx > 0 ? url.substring(0, queryIdx) : url;
    }
}
