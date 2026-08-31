# =====================================================================
# ⚠️ 로컬/단독(standalone) 개발·배포 전용 Dockerfile.
#    total_module 편입 후 Railway 배포는 이 파일이 아니라
#    상위 루트의 단일 Dockerfile(APP_MODULE 로 모듈 선택)이 담당한다.
#    참고: total_설계/로컬프로젝트_편입시_정리할것.md §3, 아키텍처_방향결정.md §3
# =====================================================================
# ===== Stage 1: 빌드 스테이지 =====
# node 미설치(JDK만). 프론트 빌드 태스크는 build.gradle 에서 npm 존재 시에만 돌도록 가드되어 있고,
# 커밋된 SPA 산출물(src/main/resources/static)을 그대로 패키징한다(설계 §4). → 이미지 빌드가 node 없이 통과.
FROM gradle:8-jdk17 AS builder

WORKDIR /build

# Gradle 파일 먼저 복사 (캐싱 활용)
COPY build.gradle settings.gradle ./
COPY gradle ./gradle

# 의존성 먼저 다운로드 (캐싱)
RUN gradle dependencies --no-daemon || true

# 소스코드 복사 및 빌드
# (node 없음 → frontendInstall/frontendBuild/copyFrontendBuild 는 onlyIf 로 skip, 커밋된 static 사용)
COPY src ./src
RUN gradle bootJar --no-daemon -x test

# ===== Stage 2: 실행 스테이지 =====
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 시간대 설정 및 curl 설치 (헬스체크용)
ENV TZ=Asia/Seoul
RUN apk add --no-cache tzdata curl && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

# JAR 파일 복사
COPY --from=builder /build/build/libs/*.jar app.jar

# 컨테이너가 사용할 포트 노출
EXPOSE 8080

# 헬스체크 (라이트 엔드포인트 /healthz — permitAll, DB 미의존)
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

# 애플리케이션 실행 (프로덕션 프로파일 사용)
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]
