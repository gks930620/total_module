package com.test.test.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

import static org.springframework.security.config.Customizer.withDefaults;

/**
 * 도구 앱 최소 보안 설정.
 *
 * <p>이 서비스는 로그인이 없고 <b>서버 API도 없는</b> 순수 클라이언트 사이드 도구 모음이다.
 * 서버는 SPA 정적 리소스 서빙과 헬스체크만 담당한다(2026-08-04 사업자 진위확인 프록시 제거).
 *
 * <p>화이트리스트 방식: 공개 경로를 명시하고 그 외(anyRequest)는 차단(denyAll).
 * 새 공개 페이지를 추가하면 아래 permitAll 목록에 반드시 등록할 것.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Content-Security-Policy — **이 사이트의 약속을 브라우저가 강제하게 만든다.**
     *
     * <p>핵심은 {@code connect-src 'none'} 이다. fetch·XHR·WebSocket·sendBeacon 이 원천 차단되므로
     * "입력한 값이 서버로 가지 않는다"(NFR-02)가 <b>주장이 아니라 브라우저가 보증하는 사실</b>이 된다.
     * 우리가 실수로 요청 코드를 넣어도 브라우저가 막는다.
     *
     * <p>{@code img-src} 도 자기 출처와 {@code data:}·{@code blob:} 뿐이다. 외부 주소를 허용하던
     * 이유는 {@code /og-preview} 가 입력한 og:image 를 그려야 해서였는데, 그 도구를 걷어내면서
     * 허용할 까닭도 사라졌다.
     *
     * <p>{@code style-src} 에 {@code 'unsafe-inline'} 이 있는 이유는 React 가 인라인 style 을 쓰기
     * 때문이다. 스타일은 데이터를 밖으로 보낼 수 없으므로 이 완화는 NFR-02 를 해치지 않는다.
     */
    private static final String CSP = String.join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "img-src 'self' data: blob:",
            "connect-src 'none'",
            "worker-src 'self' blob:",
            "object-src 'none'",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'none'");

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 세션/폼로그인 없는 무상태 정적 서빙 — CSRF 표면 없음
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .headers(headers -> headers
                        // 외부 iframe 삽입(클릭재킹) 방어
                        .frameOptions(frame -> frame.sameOrigin())
                        // 선언한 Content-Type 을 브라우저가 멋대로 다시 추측하지 않게 한다
                        .contentTypeOptions(withDefaults())
                        // 다른 사이트로 나갈 때 우리 경로를 넘기지 않는다.
                        // 도구 URL 자체가 "이 사람이 무엇을 하려 했는지" 를 말해 준다(/mask 등).
                        .referrerPolicy(ref -> ref.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        // 운영은 HTTPS 다. 한 번 다녀간 브라우저는 평문으로 돌아가지 않는다.
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31_536_000))
                        .addHeaderWriter(new StaticHeadersWriter("Content-Security-Policy", CSP))
                        // 이 사이트는 카메라·마이크·위치를 쓰지 않는다. 쓸 일이 생겨도 여기부터 열어야 한다.
                        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy",
                                "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()")));

        http.authorizeHttpRequests(auth -> auth
                .requestMatchers(
                        // 정적 리소스 (Vite 번들은 /assets/**, 아이콘/파비콘 포함)
                        "/", "/index.html", "/assets/**",
                        "/favicon.ico", "/favicon.svg", "/icons.svg", "/og-card.svg",
                        // 아이콘 폰트는 직접 서빙한다(구글 폰트 외부 요청 제거) — CSP font-src self 와 짝
                        "/fonts/**",
                        "/sitemap.xml", "/robots.txt",
                        "/error",
                        // 배포 헬스체크: /healthz(라이트) + actuator health/info
                        "/healthz",
                        "/actuator/health", "/actuator/health/**", "/actuator/info",
                        // 도구 SPA 페이지 라우트 (HomeController가 index.html로 forward)
                        // ⚠️ HomeController 의 @GetMapping 목록과 반드시 일치시킬 것 — 어긋나면 403 이 난다.
                        //    정합성은 SpaRouteApiIntegrationTest 가 검증한다.
                        "/viewer", "/json", "/convert", "/yaml", "/csv", "/json-to-type", "/dummy",
                        "/base64", "/jwt", "/hash", "/uuid", "/escape",
                        "/regex", "/diff", "/case", "/text", "/unicode",
                        "/char-count", "/line-fix", "/list-compare",
                        "/image", "/image-privacy", "/image-merge", "/favicon", "/pdf",
                        "/timestamp", "/cron", "/number-base", "/bytes", "/color",
                        "/url", "/cidr", "/qr",
                        "/curl",  "/utm", 
                             
                        // 다이어그램
                        "/erd", "/class-diagram", "/sequence", "/flowchart", "/state-diagram", "/diagram"
                ).permitAll()
                // 공개 페이지 외에는 전부 차단(안전 기본값)
                .anyRequest().denyAll());

        return http.build();
    }
}
