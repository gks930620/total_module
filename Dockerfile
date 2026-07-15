FROM eclipse-temurin:17-jdk AS builder
WORKDIR /workspace

COPY gradlew gradlew.bat settings.gradle build.gradle ./
COPY gradle ./gradle
# [새 모듈 추가 시] 아래에 COPY <module> ./<module> 한 줄 추가
COPY businesscard_qr ./businesscard_qr
COPY doll_gacha ./doll_gacha

RUN chmod +x ./gradlew
# [새 모듈 추가 시] :<module>:bootJar 추가
RUN ./gradlew --no-daemon :businesscard_qr:bootJar :doll_gacha:bootJar

# [새 모듈 추가 시] 해당 모듈 jar 추출/복사 라인 추가
RUN mkdir -p /workspace/out && \
    BUSINESS_JAR="$(find /workspace/businesscard_qr/build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*plain*' | head -n 1)" && \
    cp "$BUSINESS_JAR" /workspace/out/businesscard_qr.jar && \
    DOLL_JAR="$(find /workspace/doll_gacha/build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*plain*' | head -n 1)" && \
    cp "$DOLL_JAR" /workspace/out/doll_gacha.jar

FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /workspace/out/businesscard_qr.jar /app/businesscard_qr.jar
COPY --from=builder /workspace/out/doll_gacha.jar /app/doll_gacha.jar

RUN cat <<'EOF' > /app/start.sh
#!/bin/sh
set -eu

sanitize_quoted() {
  value="$1"
  case "$value" in
    \"*\") value=${value#\"}; value=${value%\"} ;;
  esac
  case "$value" in
    \'*\') value=${value#\'}; value=${value%\'} ;;
  esac
  printf '%s' "$value"
}

# Railway UI can display/store values with wrapping quotes.
# Sanitize known variables so both quoted and unquoted inputs work.
APP_MODULE="$(sanitize_quoted "${APP_MODULE:-businesscard_qr}")"
if [ -n "${SPRING_DATASOURCE_DRIVER:-}" ]; then
  SPRING_DATASOURCE_DRIVER="$(sanitize_quoted "$SPRING_DATASOURCE_DRIVER")"
  export SPRING_DATASOURCE_DRIVER
fi
if [ -n "${SPRING_DATASOURCE_URL:-}" ]; then
  SPRING_DATASOURCE_URL="$(sanitize_quoted "$SPRING_DATASOURCE_URL")"
  export SPRING_DATASOURCE_URL
fi
if [ -n "${SPRING_DATASOURCE_USERNAME:-}" ]; then
  SPRING_DATASOURCE_USERNAME="$(sanitize_quoted "$SPRING_DATASOURCE_USERNAME")"
  export SPRING_DATASOURCE_USERNAME
fi
if [ -n "${SPRING_DATASOURCE_PASSWORD:-}" ]; then
  SPRING_DATASOURCE_PASSWORD="$(sanitize_quoted "$SPRING_DATASOURCE_PASSWORD")"
  export SPRING_DATASOURCE_PASSWORD
fi
if [ -n "${SPRING_JPA_DDL_AUTO:-}" ]; then
  SPRING_JPA_DDL_AUTO="$(sanitize_quoted "$SPRING_JPA_DDL_AUTO")"
  export SPRING_JPA_DDL_AUTO
fi
if [ -n "${APP_JWT_SECRET:-}" ]; then
  APP_JWT_SECRET="$(sanitize_quoted "$APP_JWT_SECRET")"
  export APP_JWT_SECRET
fi
if [ -n "${APP_PUBLIC_BASE_URL:-}" ]; then
  APP_PUBLIC_BASE_URL="$(sanitize_quoted "$APP_PUBLIC_BASE_URL")"
  export APP_PUBLIC_BASE_URL
fi
if [ -n "${APP_CORS_ALLOWED_ORIGINS:-}" ]; then
  APP_CORS_ALLOWED_ORIGINS="$(sanitize_quoted "$APP_CORS_ALLOWED_ORIGINS")"
  export APP_CORS_ALLOWED_ORIGINS
fi
if [ -n "${SPRING_PROFILES_ACTIVE:-}" ]; then
  SPRING_PROFILES_ACTIVE="$(sanitize_quoted "$SPRING_PROFILES_ACTIVE")"
  export SPRING_PROFILES_ACTIVE
fi

# [새 모듈 추가 시] 허용 목록에 모듈명 추가 (예: businesscard_qr|project_a)
case "$APP_MODULE" in
  businesscard_qr|doll_gacha) ;;
  *) echo "APP_MODULE must be one of: businesscard_qr, doll_gacha (got: $APP_MODULE)"; exit 1 ;;
esac

# JVM 메모리 상한 (비용 절감 — JVM 기본 힙은 컨테이너 RAM의 25%라 방치하면 큼).
# 모든 모듈 공통 기본값. 특정 서비스만 조정하려면 Railway 서비스 env 로 JAVA_OPTS 를 주면 그 값이 우선한다.
# OOM(로그 OutOfMemoryError/재시작) 시 -Xmx 를 384m→512m 로 올린다.
JAVA_OPTS="${JAVA_OPTS:--Xmx384m -XX:+UseSerialGC -XX:MaxMetaspaceSize=128m}"

# shellcheck disable=SC2086  # JAVA_OPTS 는 여러 플래그라 의도적으로 분리(word-split)
exec java $JAVA_OPTS -Dserver.port="${PORT:-8080}" -jar "/app/${APP_MODULE}.jar"
EOF
RUN chmod +x /app/start.sh

EXPOSE 8080
ENTRYPOINT ["/app/start.sh"]
