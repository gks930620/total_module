package com.test.test.jwt.config;

import com.test.test.jwt.JwtUtil;
import com.test.test.jwt.filter.JwtAccessTokenCheckAndSaveUserInfoFilter;
import com.test.test.jwt.filter.JwtLoginFilter;
import com.test.test.jwt.handler.CustomLogoutSuccessHandler;
import com.test.test.jwt.handler.OAuth2LoginSuccessHandler;
import com.test.test.jwt.service.CustomOAuth2UserService;
import com.test.test.jwt.service.CustomUserDetailsService;
import com.test.test.jwt.service.RefreshService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final CustomUserDetailsService customUserDetailsService;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final AuthenticationConfiguration authenticationConfiguration;
    private final RefreshService refreshService;
    private final AuthorizationRequestRepository authorizationRequestRepository;
    private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
    private final CustomLogoutSuccessHandler customLogoutSuccessHandler;

    @Value("${app.cookie.secure:false}")
    private boolean secureCookie;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                        .requestMatchers("/h2-console/**").permitAll())
                .csrf(csrf -> csrf.ignoringRequestMatchers("/h2-console/**"))
                .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable());

        http.logout(logout -> logout
                .logoutUrl("/api/logout")
                .logoutSuccessHandler(customLogoutSuccessHandler));

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        "/css/**", "/js/**", "/images/**", "/favicon.ico", "/uploads/**",
                        "/h2-console/**",
                        "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/swagger-resources/**",
                        "/actuator/**",
                        "/", "/login", "/signup", "/mypage", "/community/**",
                        "/rooms", "/rooms/**",
                        "/ws-chat", "/ws-chat/**",
                        "/custom-oauth2/login/**"
                ).permitAll()
                .requestMatchers(
                        "/api/login",
                        "/api/users",
                        "/api/tokens/refresh",
                        "/api/oauth2/**"
                ).permitAll()
                .requestMatchers(HttpMethod.GET,
                        "/api/communities",
                        "/api/communities/*",
                        "/api/communities/*/comments",
                        "/api/files",
                        "/api/files/paths",
                        "/api/files/*/content"
                ).permitAll()
                .requestMatchers(
                        "/api/logout",
                        "/api/users/me",
                        "/api/rooms", "/api/rooms/**"
                ).authenticated()
                .requestMatchers(HttpMethod.POST,
                        "/api/communities",
                        "/api/communities/*/comments",
                        "/api/files"
                ).authenticated()
                .requestMatchers(HttpMethod.PUT,
                        "/api/communities/**",
                        "/api/comments/**"
                ).authenticated()
                .requestMatchers(HttpMethod.DELETE,
                        "/api/communities/**",
                        "/api/comments/**",
                        "/api/files/**"
                ).authenticated()
                .anyRequest().permitAll());

        http.oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(authEndpoint ->
                        authEndpoint.authorizationRequestRepository(authorizationRequestRepository))
                .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                .successHandler(oAuth2LoginSuccessHandler)
                .failureHandler((request, response, exception) -> {
                    exception.printStackTrace();
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                }));

        http.userDetailsService(customUserDetailsService)
                .addFilterAt(
                        new JwtLoginFilter(authenticationConfiguration.getAuthenticationManager(), jwtUtil,
                                refreshService, "/api/login", secureCookie),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(
                        new JwtAccessTokenCheckAndSaveUserInfoFilter(jwtUtil, customUserDetailsService),
                        UsernamePasswordAuthenticationFilter.class);

        http.exceptionHandling(ex -> ex.authenticationEntryPoint((request, response, authException) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");

            String errorCause = request.getAttribute("ERROR_CAUSE") != null
                    ? (String) request.getAttribute("ERROR_CAUSE")
                    : "NOT_AUTHENTICATED";

            String errorMessage;
            String errorCode;
            if ("TOKEN_EXPIRED".equals(errorCause)) {
                errorMessage = "Access token expired";
                errorCode = "TOKEN_EXPIRED";
            } else if ("INVALID_TOKEN".equals(errorCause)) {
                errorMessage = "Invalid token";
                errorCode = "INVALID_TOKEN";
            } else {
                errorMessage = "Authentication required";
                errorCode = "NOT_AUTHENTICATED";
            }

            String jsonResponse = String.format(
                    "{\"success\":false,\"message\":\"%s\",\"errorCode\":\"%s\",\"timestamp\":\"%s\"}",
                    errorMessage, errorCode, java.time.LocalDateTime.now()
            );
            response.getWriter().write(jsonResponse);
        }));

        return http.build();
    }
}
