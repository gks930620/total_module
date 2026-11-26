package com.businesscard.billing.service;

import com.businesscard.billing.config.BillingProperties;
import com.businesscard.common.exception.StoreUnavailableException;
import io.jsonwebtoken.Jwts;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Date;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * App Store Connect API 호출용 ES256 JWT 발급.
 *
 * <p>구독 상태를 해석하는 일({@link AppStoreReceiptClient})과 <b>Apple 에 우리를 증명하는 일</b>은
 * 다른 관심사라 떼어 뒀다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppStoreApiTokenProvider {

    private static final String AUDIENCE = "appstoreconnect-v1";

    /** Apple 이 허용하는 토큰 수명 상한은 1시간이다. 여유를 두고 그보다 짧게 잡는다. */
    private static final long TOKEN_TTL_SECONDS = 3000;

    private final BillingProperties billingProperties;

    /**
     * 매 요청 새로 만든다. 수명이 짧고 ES256 서명 비용이 작아 캐시할 이득이 없다
     * (Google 쪽은 토큰을 받아 오는 <b>왕복</b>이 있어서 캐시한다).
     */
    public String signedToken() {
        try {
            PrivateKey privateKey = PemKeys.parsePkcs8(billingProperties.getApplePrivateKey(), "EC");
            Instant now = Instant.now();
            return Jwts.builder()
                    .header().keyId(billingProperties.getAppleKeyId()).and()
                    .issuer(billingProperties.getAppleIssuerId())
                    .audience().add(AUDIENCE).and()
                    .claim("bid", billingProperties.getAppleBundleId())
                    .issuedAt(Date.from(now))
                    .expiration(Date.from(now.plusSeconds(TOKEN_TTL_SECONDS)))
                    .signWith(privateKey, Jwts.SIG.ES256)
                    .compact();
        } catch (Exception e) {
            // 개인키가 로그에 섞이지 않도록 예외 타입만 남긴다.
            log.error("App Store Connect API 토큰 생성 실패: {}", e.getClass().getSimpleName());
            throw new StoreUnavailableException("App Store 인증에 실패했습니다.");
        }
    }
}
