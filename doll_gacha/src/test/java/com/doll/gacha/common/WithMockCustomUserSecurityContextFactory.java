package com.doll.gacha.common;

import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.model.UserDTO;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithSecurityContextFactory;

import java.util.Arrays;

/**
 * WithMockCustomUser 어노테이션을 위한 SecurityContext Factory
 * 테스트 시 CustomUserAccount를 사용한 인증 컨텍스트를 생성합니다.
 */
public class WithMockCustomUserSecurityContextFactory implements WithSecurityContextFactory<WithMockCustomUser> {

    @Override
    public SecurityContext createSecurityContext(WithMockCustomUser annotation) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();

        // UserDTO 생성
        UserDTO userDTO = UserDTO.builder()
                .id(1L)  // 테스트용 ID
                .username(annotation.username())
                .password(annotation.password())
                .email(annotation.email())
                .nickname(annotation.nickname())
                .roles(Arrays.asList(annotation.roles()))
                .build();

        // CustomUserAccount 생성 (컨트롤러에서 @AuthenticationPrincipal로 받는 객체)
        CustomUserAccount customUserAccount = new CustomUserAccount(userDTO);

        // Authentication 객체 생성 (principal이 CustomUserAccount)
        Authentication auth = new UsernamePasswordAuthenticationToken(
                customUserAccount,
                null,
                customUserAccount.getAuthorities()
        );

        context.setAuthentication(auth);
        return context;
    }
}

