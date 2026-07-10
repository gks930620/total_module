package com.doll.gacha.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
@Slf4j
public class WebConfig implements WebMvcConfigurer {

    // 업로드 파일은 스토리지 전략(Storage Bucket S3 / 로컬 디스크 폴백)에 저장하고
    // FileController 의 GET /uploads/{storedFileName} 가 읽어서 서빙한다 → 정적 리소스 핸들러 불필요.

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        // Pageable 기본값 설정
        PageableHandlerMethodArgumentResolver resolver = new PageableHandlerMethodArgumentResolver();
        resolver.setFallbackPageable(PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "id")));
        resolver.setMaxPageSize(100); // 최대 페이지 크기 제한
        resolvers.add(resolver);
    }
}

