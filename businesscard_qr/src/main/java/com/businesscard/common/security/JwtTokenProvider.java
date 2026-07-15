package com.businesscard.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    private final SecretKey secretKey;
    private final long accessTokenValiditySeconds;
    private final long refreshTokenValiditySeconds;

    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-validity-seconds:3600}") long accessTokenValiditySeconds,
            @Value("${app.jwt.refresh-token-validity-seconds:1209600}") long refreshTokenValiditySeconds
    ) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalArgumentException("app.jwt.secret must be at least 32 characters.");
        }

        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenValiditySeconds = accessTokenValiditySeconds;
        this.refreshTokenValiditySeconds = refreshTokenValiditySeconds;
    }

    public String createAccessToken(String userId) {
        return createToken(userId, TYPE_ACCESS, accessTokenValiditySeconds);
    }

    public String createRefreshToken(String userId) {
        return createToken(userId, TYPE_REFRESH, refreshTokenValiditySeconds);
    }

    private String createToken(String userId, String type, long validitySeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(validitySeconds)))
                .claim("typ", type)
                .signWith(secretKey)
                .compact();
    }

    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * 서명·만료가 유효하면서 typ 클레임이 access인 토큰인지 검증한다.
     *
     * <p>인증 필터는 반드시 이 메서드를 써야 한다. 서명·만료만 보는 {@link #isValid}로 통과시키면
     * <b>refresh 토큰(수명 14일)을 access 토큰처럼 API 키로 사용</b>할 수 있어 짧은 access 수명 설계가 무력화된다.
     */
    public boolean isAccessToken(String token) {
        try {
            return TYPE_ACCESS.equals(parseClaims(token).get("typ", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /** 서명·만료가 유효하면서 typ 클레임이 refresh인 토큰인지 검증한다. */
    public boolean isRefreshToken(String token) {
        try {
            return TYPE_REFRESH.equals(parseClaims(token).get("typ", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String getUserId(String token) {
        return parseClaims(token).getSubject();
    }

    public long getAccessTokenValiditySeconds() {
        return accessTokenValiditySeconds;
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
