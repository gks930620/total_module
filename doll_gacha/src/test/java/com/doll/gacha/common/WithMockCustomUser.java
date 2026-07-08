package com.doll.gacha.common;

import org.springframework.security.test.context.support.WithSecurityContext;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 커스텀 사용자 인증을 위한 테스트 어노테이션
 * @WithMockUser 대신 사용하여 CustomUserAccount를 SecurityContext에 설정합니다.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
@WithSecurityContext(factory = WithMockCustomUserSecurityContextFactory.class)
public @interface WithMockCustomUser {
    String username() default "testuser";
    String password() default "password123";
    String email() default "test@example.com";
    String nickname() default "테스터";
    String[] roles() default {"ROLE_USER"};
}

