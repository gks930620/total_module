package com.doll.gacha.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.config.PageableHandlerMethodArgumentResolverCustomizer;

@Configuration
public class WebConfig {

    // 업로드 파일은 스토리지 전략(Storage Bucket S3 / 로컬 디스크 폴백)에 저장하고
    // FileController 의 GET /uploads/{storedFileName} 가 읽어서 서빙한다 → 정적 리소스 핸들러 불필요.

    /**
     * Pageable 기본값/상한 설정.
     *
     * <p>WebMvcConfigurer.addArgumentResolvers 로 PageableHandlerMethodArgumentResolver 를
     * 직접 추가하면, Spring Data 자동설정({@code SpringDataWebAutoConfiguration})의 기본 리졸버가
     * {@code @ConditionalOnMissingBean} 조건 때문에 비활성화되지 않고 <b>함께</b> 등록되어,
     * 둘 중 어느 쪽이 먼저 매칭될지가 비결정적이 된다 → maxPageSize(100) 상한이 보장되지 않을 수 있음.
     *
     * <p>Customizer 빈으로 <b>자동설정 리졸버 자체</b>를 수정하면 상한이 확실히 적용된다.
     */
    @Bean
    PageableHandlerMethodArgumentResolverCustomizer pageableCustomizer() {
        return resolver -> {
            resolver.setMaxPageSize(100); // 최대 페이지 크기 제한 (과도한 size 요청 방어)
            resolver.setFallbackPageable(PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "id")));
        };
    }
}
