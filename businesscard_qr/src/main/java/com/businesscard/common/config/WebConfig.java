package com.businesscard.common.config;

import java.time.Duration;
import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@Slf4j
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173,http://localhost:8080}")
    private String allowedOrigins;

    // 업로드 파일은 FileController가 스토리지 추상화를 통해 서빙한다(DB/로컬 통일).

    /**
     * 웹앱 번들({@code /assets/index-해시.js})은 1년 캐시한다.
     *
     * <p>이름에 내용 해시가 붙어서, 내용이 바뀌면 이름이 바뀐다 — 오래 캐시해도 낡은 파일을 쓸 일이 없다.
     * 이 설정이 없으면 스프링 시큐리티 기본값(no-store)이 붙어, 서비스워커가 없는 곳
     * (카톡 인앱 브라우저로 명함 링크를 여는 경우 등)에서 열 때마다 번들 전체를 다시 받는다.
     *
     * <p>index.html·sw.js 는 여기 넣지 않는다 — "이번 배포의 번들 이름"과 "새 워커"를 담고 있어 오래 캐시하면
     * 배포가 반영되지 않는다.
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .map(this::stripWrappingQuotes)
                .filter(origin -> !origin.isBlank())
                .toArray(String[]::new);

        registry.addMapping("/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Set-Cookie", "Authorization")
                .allowCredentials(true)
                .maxAge(3600);
    }

    private String stripWrappingQuotes(String value) {
        if (value == null) {
            return "";
        }
        if (value.length() >= 2) {
            boolean wrappedInDoubleQuotes = value.startsWith("\"") && value.endsWith("\"");
            boolean wrappedInSingleQuotes = value.startsWith("'") && value.endsWith("'");
            if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
                return value.substring(1, value.length() - 1).trim();
            }
        }
        return value;
    }
}
