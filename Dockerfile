FROM eclipse-temurin:17-jdk AS builder
WORKDIR /workspace

COPY gradlew gradlew.bat settings.gradle build.gradle ./
COPY gradle ./gradle
COPY businesscard_qr ./businesscard_qr
COPY dist_api_gateway ./dist_api_gateway

RUN chmod +x ./gradlew
RUN ./gradlew --no-daemon :businesscard_qr:bootJar :dist_api_gateway:bootJar

RUN mkdir -p /workspace/out && \
    BUSINESS_JAR="$(find /workspace/businesscard_qr/build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*plain*' | head -n 1)" && \
    GATEWAY_JAR="$(find /workspace/dist_api_gateway/build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*plain*' | head -n 1)" && \
    cp "$BUSINESS_JAR" /workspace/out/businesscard_qr.jar && \
    cp "$GATEWAY_JAR" /workspace/out/dist_api_gateway.jar

FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /workspace/out/businesscard_qr.jar /app/businesscard_qr.jar
COPY --from=builder /workspace/out/dist_api_gateway.jar /app/dist_api_gateway.jar

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
APP_MODULE="$(sanitize_quoted "${APP_MODULE:-dist_api_gateway}")"
if [ -n "${APP_GATEWAY_BUSINESS_QR_URL:-}" ]; then
  APP_GATEWAY_BUSINESS_QR_URL="$(sanitize_quoted "$APP_GATEWAY_BUSINESS_QR_URL")"
  export APP_GATEWAY_BUSINESS_QR_URL
fi
if [ -n "${APP_GATEWAY_TARGET_BASE_URL:-}" ]; then
  APP_GATEWAY_TARGET_BASE_URL="$(sanitize_quoted "$APP_GATEWAY_TARGET_BASE_URL")"
  export APP_GATEWAY_TARGET_BASE_URL
fi
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
if [ -n "${APP_CORS_ALLOWED_ORIGINS:-}" ]; then
  APP_CORS_ALLOWED_ORIGINS="$(sanitize_quoted "$APP_CORS_ALLOWED_ORIGINS")"
  export APP_CORS_ALLOWED_ORIGINS
fi

case "$APP_MODULE" in
  businesscard_qr|dist_api_gateway) ;;
  *) echo "APP_MODULE must be businesscard_qr or dist_api_gateway (got: $APP_MODULE)"; exit 1 ;;
esac

exec java -Dserver.port="${PORT:-8080}" -jar "/app/${APP_MODULE}.jar"
EOF
RUN chmod +x /app/start.sh

EXPOSE 8080
ENTRYPOINT ["/app/start.sh"]
