package com.doll.gacha.jwt.config;

import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.filter.JwtAccessTokenCheckAndSaveUserInfoFilter;
import com.doll.gacha.jwt.filter.JwtLoginFilter;
import com.doll.gacha.jwt.handler.CustomLogoutSuccessHandler;
import com.doll.gacha.jwt.handler.OAuth2LoginSuccessHandler;
import com.doll.gacha.jwt.service.CustomOAuth2UserService;
import com.doll.gacha.jwt.service.CustomUserDetailsService;
import com.doll.gacha.jwt.service.RefreshService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService customUserDetailsService;
    private final CustomOAuth2UserService customOAuth2UserService;

    private final AuthenticationConfiguration authenticationConfiguration;

    private final RefreshService refreshService;
    private final AuthorizationRequestRepository authorizationRequestRepository;

    // handler 패키지로 이동된 클래스들
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final CustomLogoutSuccessHandler customLogoutSuccessHandler;

    // 쿠키 secure 플래그 (로컬 false / 운영 true) — 로그인 필터에 전달
    @org.springframework.beans.factory.annotation.Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    // H2 콘솔 활성화 여부 (로컬 true / 운영 false). 콘솔을 쓸 때만 iframe/csrf 예외를 연다.
    @org.springframework.beans.factory.annotation.Value("${spring.h2.console.enabled:false}")
    private boolean h2ConsoleEnabled;


    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }


    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // H2 콘솔(로컬 전용)을 쓸 때만 iframe/CSRF 예외를 연다.
        // 운영(prod)에서는 h2ConsoleEnabled=false → frameOptions 기본 보호(clickjacking 방어) 유지
        if (h2ConsoleEnabled) {
            http  //내부H2DB  확인용. 로컬 개발 전용.
                .authorizeHttpRequests(auth -> auth
                    .requestMatchers("/h2-console/**").permitAll() // H2 콘솔 접근 허용
                )
                .csrf(csrf -> csrf.ignoringRequestMatchers("/h2-console/**")) // H2 콘솔 CSRF 비활성화
                .headers(
                    headers -> headers.frameOptions(frame -> frame.disable())); // H2 콘솔을 iframe에서 허용
        }

        http    //기본 session방식관련 다 X
            .cors(Customizer.withDefaults())  // CORS 활성화 (CorsConfig 설정 사용)
            .csrf(csrf -> csrf.disable())
            .sessionManagement(
                session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable());

        http.logout(logout -> logout
            .logoutUrl("/api/logout")
            .logoutSuccessHandler(customLogoutSuccessHandler)
        );

        http   //경로와 인증/인가 설정.
            .authorizeHttpRequests(auth -> auth
                // 1. 정적 리소스, 페이지 등 기본적으로 모두 허용
                .requestMatchers(
                    // 정적 리소스 (Vite 빌드 산출물 /assets/** , /index.html 포함)
                    "/css/**", "/js/**", "/images/**", "/favicon.ico", "/uploads/**",
                    "/assets/**", "/index.html", "/vite.svg",
                    // h2-console
                    "/h2-console/**",
                    // Swagger UI
                    "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/swagger-resources/**",
                    // Actuator (서버 상태 모니터링)
                    "/actuator/**",
                    // Railway 헬스체크 (railway.toml healthcheckPath)
                    "/healthz",
                    // 페이지 URL (CSR이므로 페이지 자체는 모두 허용 - API에서 인증 체크)
                    "/", "/map", "/login", "/signup", "/mypage", "/community/**", "/doll/**", "/doll-shop/**",  "/review/**",
                    // Spring 기본 에러 디스패치
                    "/error",
                    // 인증 관련 API
                    "/api/login", "/api/join", "/api/refresh/reissue",
                    // OAuth2 (커스텀 시작 + Spring 콜백/인가요청 엔드포인트)
                    "/custom-oauth2/login/**",
                    "/api/oauth2/**",          // 앱용 OAuth2 엔드포인트 (내부에서 provider 토큰 검증)
                    "/login/oauth2/**",        // Spring OAuth2 콜백 (/login/oauth2/code/{provider})
                    "/oauth2/**",              // Spring OAuth2 인가요청
                    // 공개 API
                    "/api/doll-shops/**",
                    "/api/reviews/doll-shop/**",  // 리뷰 조회는 공개
                    "/api/files/download/**"      // 파일 다운로드 공개
                ).permitAll()

                // 1-1. 공개 조회는 GET 만 허용 (쓰기 요청은 아래 인증 규칙 적용)
                .requestMatchers(
                    org.springframework.http.HttpMethod.GET,
                    "/api/community", "/api/community/{id:[0-9]+}", // 커뮤니티 목록/상세
                    "/api/comments/**",                            // 댓글 조회
                    "/api/files", "/api/files/detail"              // 첨부/이미지 목록 조회
                ).permitAll()

                // 2. 인증이 필요한 API
                .requestMatchers(
                    "/api/logout",  // 로그아웃은 로그인한 사용자만 가능
                    "/api/my/info",
                    "/api/files/upload"  // 파일 업로드는 인증 필요
                ).authenticated()
                // 파일 삭제는 인증 필요 (다운로드 GET 은 위에서 공개)
                .requestMatchers(
                    org.springframework.http.HttpMethod.DELETE, "/api/files/**"
                ).authenticated()

                // 3. 커뮤니티 작성/수정/삭제는 인증 필요
                .requestMatchers(
                    org.springframework.http.HttpMethod.POST, "/api/community", "/api/community/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.PUT, "/api/community/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.DELETE, "/api/community/**"
                ).authenticated()

                // 4. 리뷰 작성/수정/삭제는 인증 필요 (POST, PUT, PATCH, DELETE)
                .requestMatchers(
                    org.springframework.http.HttpMethod.POST, "/api/reviews/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.PUT, "/api/reviews/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.PATCH, "/api/reviews/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.DELETE, "/api/reviews/**"
                ).authenticated()

                // 5. 댓글 작성/수정/삭제는 인증 필요 (POST, PUT, DELETE)
                .requestMatchers(
                    org.springframework.http.HttpMethod.POST, "/api/comments/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.PUT, "/api/comments/**"
                ).authenticated()
                .requestMatchers(
                    org.springframework.http.HttpMethod.DELETE, "/api/comments/**"
                ).authenticated()

                // 6. 화이트리스트 방식: 위에서 명시적으로 허용하지 않은 모든 요청은 인증 필요
                .anyRequest().authenticated()
            );


        http.oauth2Login(oauth2 -> oauth2
            .authorizationEndpoint(authEndpoint -> authEndpoint
                .authorizationRequestRepository(authorizationRequestRepository)) // ✅ 직접 구현한 저장소 적용
            .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
            .successHandler(oAuth2LoginSuccessHandler) // ✅ 로그인 성공 시 JWT 발급
             // 이 부분이  jwt방식이냐   session방식이냐를 가른다!
            .failureHandler((request, response, exception) -> {
                log.warn("OAuth2 로그인 실패: {}", exception.getMessage(), exception);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            })  // ✅ 실패 시 로그 남기기
        );


        http          //필터
            .userDetailsService(customUserDetailsService)
            .addFilterAt(
                new JwtLoginFilter(authenticationConfiguration.getAuthenticationManager(), jwtUtil,
                    refreshService, "/api/login", cookieSecure),  //이 부분때문에 이 url일 때만 동작
                UsernamePasswordAuthenticationFilter.class)  //기존 세션방식의 로그인 검증필터 대체.
            .addFilterBefore(
                new JwtAccessTokenCheckAndSaveUserInfoFilter(jwtUtil, customUserDetailsService),
                UsernamePasswordAuthenticationFilter.class);

       
        http
            .exceptionHandling(ex -> ex
                  // 여기는 인증된 api요청에 토큰 없이 접근하려고 할 때
                 //JwtLoginFilter는 로그인 시도하려고 할 때.. 즉 id pw입력한거 비교할 때
                .authenticationEntryPoint((request, response, authException) -> {
                    // ErrorResponse 형식으로 통일된 응답
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json;charset=UTF-8");

                    String errorCause = request.getAttribute("ERROR_CAUSE") != null
                        ? (String) request.getAttribute("ERROR_CAUSE")
                        : "NOT_AUTHENTICATED";

                    String errorMessage;
                    String errorCode;

                    if ("토큰만료".equals(errorCause)) {
                        errorMessage = "Access Token이 만료되었습니다. 토큰을 재발급해주세요.";
                        errorCode = "TOKEN_EXPIRED";
                    } else if ("잘못된토큰".equals(errorCause)) {
                        errorMessage = "유효하지 않은 토큰입니다.";
                        errorCode = "INVALID_TOKEN";
                    } else {
                        errorMessage = "인증이 필요합니다.";
                        errorCode = "NOT_AUTHENTICATED";
                    }

                    // ErrorResponse 형식으로 응답
                    String jsonResponse = String.format(
                        "{\"success\":false,\"message\":\"%s\",\"errorCode\":\"%s\",\"timestamp\":\"%s\"}",
                        errorMessage, errorCode, java.time.LocalDateTime.now()
                    );
                    response.getWriter().write(jsonResponse);
                })
            );
        return http.build();
    }


}

