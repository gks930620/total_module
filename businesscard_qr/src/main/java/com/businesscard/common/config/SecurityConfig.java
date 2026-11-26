package com.businesscard.common.config;

import com.businesscard.common.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    /**
     * Content-Security-Policy — 웹앱을 서빙하면서 생긴 방어선. 설계 웹앱_전환_설계.md.
     *
     * <ul>
     *   <li>{@code script-src 'self'} — 우리 번들만 실행된다. <b>인라인 스크립트도 막힌다</b>
     *       ({@code 'unsafe-inline'} 을 넣으면 CSP 가 XSS 를 거의 못 막는다). 그래서 정적 문서의
     *       스크립트도 {@code /legal.js} 로 뺐다.</li>
     *   <li>{@code style-src 'unsafe-inline'} — 스타일만은 허용한다. 정적 문서의 {@code style=""} 속성 때문이고,
     *       스타일 주입은 스크립트 실행보다 위험이 훨씬 작다.</li>
     *   <li>{@code img-src data: blob:} — QR 은 SVG data URL, 업로드 전 미리보기는 blob URL 이다.</li>
     *   <li>{@code connect-src 'self'} — API 는 같은 오리진뿐.</li>
     *   <li>{@code frame-ancestors 'self'} — 남의 사이트가 우리 화면을 iframe 에 못 넣는다(클릭재킹).</li>
     *   <li><b>토스페이먼츠 결제창</b>(설계 웹결제_설계.md) — 외부로 여는 건 토스 도메인뿐이다.
     *       스크립트는 SDK 주소 하나({@code js.tosspayments.com})만, 결제창 iframe·SDK 통신·결제창 이동은
     *       {@code *.tosspayments.com} 만 허용한다.</li>
     * </ul>
     *
     * <p>세션 쿠키가 HttpOnly 라 XSS 로 토큰을 훔칠 순 없다. 하지만 스크립트가 돌면
     * <b>사용자 대신 API 를 부를 수는 있다</b> — 그걸 막는 게 이 정책이다.
     */
    private static final String TOSS_SDK = "https://js.tosspayments.com";
    private static final String TOSS = "https://*.tosspayments.com";

    static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self' " + TOSS_SDK,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: " + TOSS,
            "font-src 'self'",
            "connect-src 'self' " + TOSS,
            "frame-src " + TOSS,
            "manifest-src 'self'",
            "worker-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self' " + TOSS,
            "frame-ancestors 'self'");

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CSRF 토큰 체계는 쓰지 않는다. 앱은 헤더(Bearer)라 CSRF 와 무관하고,
                // 웹 세션 쿠키는 SameSite=Strict 로 교차 사이트 요청에 실리지 않는다 — AuthCookies 참고.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exception -> exception.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .headers(headers -> headers
                        .frameOptions(frame -> frame.sameOrigin())
                        .contentTypeOptions(Customizer.withDefaults())
                        // 다른 사이트로 나갈 때 경로를 넘기지 않는다 — /c/{id} 에는 명함 id 가 들어 있다.
                        .referrerPolicy(ref -> ref.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000))
                        .addHeaderWriter(new StaticHeadersWriter("Content-Security-Policy", CSP))
                        // 카메라는 명함 사진 촬영에 쓴다(파일 선택 → 카메라). 나머지는 쓰지 않는다.
                        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                                "camera=(self), microphone=(), geolocation=(), usb=(), interest-cohort=()")))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/business-cards/*/downloads/**").permitAll()
                        // 공개 명함 보기 — 링크(UUID)를 아는 사람이 로그인 없이 여는 경로.
                        // 설계 웹앱_전환_설계.md §4. 응답은 축소형(PublicBusinessCardResponse)이다.
                        .requestMatchers(HttpMethod.GET, "/api/business-cards/*/public", "/api/business-cards/*/public/vcf").permitAll()
                        // 조회수 증가는 비로그인 방문자도 올릴 수 있어야 하므로 공개
                        .requestMatchers(HttpMethod.POST, "/api/business-cards/*/view-count").permitAll()
                        // 토스 웹훅 — 토스 서버가 로그인 없이 부른다. 본문을 믿지 않고 토스에 다시 묻는다(WebCheckoutService).
                        .requestMatchers(HttpMethod.POST, "/api/billing/web/webhook").permitAll()
                        // 평생 이용권 가격 — 첫 화면(로그인 전) 요금 안내용. 가격·판매 여부만 담겨 있다.
                        .requestMatchers(HttpMethod.GET, "/api/billing/web/lifetime").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        // 웹앱 화면·정적 파일·/uploads/** — 화면 자체는 공개다(데이터는 API 가 지킨다).
                        .anyRequest().permitAll())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
