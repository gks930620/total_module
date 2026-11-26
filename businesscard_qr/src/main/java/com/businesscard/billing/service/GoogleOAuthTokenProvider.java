package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.common.exception.StoreUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Date;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

/**
 * Google 서비스 계정 → Android Publisher API 액세스 토큰.
 *
 * <p>영수증을 조회하는 일({@link GooglePlayReceiptClient})과 <b>Google 에 우리를 증명하는 일</b>은
 * 다른 관심사다. 토큰 캐시·만료 계산이 영수증 해석 코드 사이에 끼어 있으면 양쪽 다 읽기 어렵다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoogleOAuthTokenProvider {

    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String SCOPE = "https://www.googleapis.com/auth/androidpublisher";
    private static final String JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";

    /** 만료 직전에 쓰다가 거절당하지 않도록 이만큼 미리 새로 받는다. */
    private static final long REFRESH_MARGIN_SECONDS = 60;

    /** 서비스 계정 JWT 의 수명. Google 이 허용하는 상한이 1시간이다. */
    private static final long ASSERTION_TTL_SECONDS = 3600;

    private final BillingProperties billingProperties;
    private final ObjectMapper objectMapper;
    private final RestClient storeRestClient;

    private volatile String cachedToken;
    private volatile Instant cachedTokenExpiresAt;

    /** 유효한 토큰이 있으면 그대로, 없으면 새로 받아서 돌려준다. */
    public String accessToken() {
        String token = cachedToken;
        Instant expiresAt = cachedTokenExpiresAt;
        if (token != null && expiresAt != null
                && Instant.now().isBefore(expiresAt.minusSeconds(REFRESH_MARGIN_SECONDS))) {
            return token;
        }
        return issue();
    }

    private String issue() {
        try {
            JsonNode serviceAccount = objectMapper.readTree(billingProperties.getGoogleServiceAccountJson());
            Instant now = Instant.now();

            String assertion = Jwts.builder()
                    .issuer(serviceAccount.path("client_email").asText())
                    .audience().add(TOKEN_URI).and()
                    .claim("scope", SCOPE)
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(now.plusSeconds(ASSERTION_TTL_SECONDS)))
                    .signWith(privateKeyOf(serviceAccount), Jwts.SIG.RS256)
                    .compact();

            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("grant_type", JWT_BEARER);
            form.add("assertion", assertion);

            String body = storeRestClient.post()
                    .uri(TOKEN_URI)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);

            JsonNode response = objectMapper.readTree(body);
            String issued = response.path("access_token").asText();
            cachedToken = issued;
            cachedTokenExpiresAt = now.plusSeconds(response.path("expires_in").asLong(ASSERTION_TTL_SECONDS));
            return issued;
        } catch (Exception e) {
            // 개인키·서비스 계정 JSON 이 로그에 섞이지 않도록 예외 타입만 남긴다.
            log.error("Google 서비스 계정 액세스 토큰 발급 실패: {}", e.getClass().getSimpleName());
            throw new StoreUnavailableException("Google Play 인증에 실패했습니다.");
        }
    }

    private PrivateKey privateKeyOf(JsonNode serviceAccount) {
        return PemKeys.parsePkcs8(serviceAccount.path("private_key").asText(), "RSA");
    }
}
