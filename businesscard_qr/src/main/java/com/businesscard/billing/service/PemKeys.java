package com.businesscard.billing.service;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * PEM 개인키 문자열 → {@link PrivateKey}.
 *
 * <p>Google 서비스 계정 JSON 의 {@code private_key}(RSA)와 Apple 의 {@code .p8}(EC) 모두
 * PKCS#8 PEM 이라 헤더/푸터와 줄바꿈만 걷어내면 같은 방식으로 읽힌다.
 */
abstract class PemKeys {

    private PemKeys() {
    }

    static PrivateKey parsePkcs8(String pem, String algorithm) {
        String base64 = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                // 환경변수로 넣을 때 줄바꿈이 \n 문자열로 들어오는 경우가 흔하다.
                .replace("\\n", "")
                .replaceAll("\\s", "");

        byte[] der = Base64.getDecoder().decode(base64);
        try {
            return KeyFactory.getInstance(algorithm).generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("개인키를 읽을 수 없습니다 (algorithm=" + algorithm + ")", e);
        }
    }
}
