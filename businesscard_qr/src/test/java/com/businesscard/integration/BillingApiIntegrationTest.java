package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.businesscard.billing.entity.SubscriptionStatus;
import com.businesscard.billing.repository.SubscriptionRepository;
import com.businesscard.billing.service.StoreReceiptVerifier;
import com.businesscard.billing.service.VerifiedPurchase;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.StoreUnavailableException;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 인앱결제 API 계약 검증 — `설계/인앱결제_설계.md` 가 기준이다.
 *
 * <p>스토어 검증기({@link StoreReceiptVerifier})는 목으로 대체한다. 실제 Google/Apple 호출은
 * 네트워크·자격증명에 의존해 테스트를 비결정적으로 만들기 때문. 여기서 지키려는 것은
 * "스토어가 이렇게 답했을 때 우리 API 가 무엇을 돌려주는가"라는 계약이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-billing",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long",
        "app.billing.free-card-limit=3",
        "app.billing.pro-product-ids=pro_monthly"
})
class BillingApiIntegrationTest {

    private static final String TEST_USER_ID = "kakao_900";
    private static final String OTHER_USER_ID = "kakao_901";
    private static final String PRO_PRODUCT_ID = "pro_monthly";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BusinessCardRepository businessCardRepository;

    @Autowired
    private SubscriptionRepository subscriptionRepository;

    @MockBean
    private AuthService authService;

    @MockBean
    private StoreReceiptVerifier storeReceiptVerifier;

    private String accessToken;

    @BeforeEach
    void setUp() {
        subscriptionRepository.deleteAll();
        businessCardRepository.deleteAll();
        userRepository.deleteAll();

        saveUser(TEST_USER_ID);
        saveUser(OTHER_USER_ID);
        accessToken = jwtTokenProvider.createAccessToken(TEST_USER_ID);
    }

    // ─────────────────────────── GET /api/billing/entitlement ───────────────────────────

    @Test
    void getEntitlement_freeUser_returnsLimitAndCount() throws Exception {
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);

        mockMvc.perform(get("/api/billing/entitlement")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.pro").value(false))
                .andExpect(jsonPath("$.data.card_count").value(2))
                .andExpect(jsonPath("$.data.card_limit").value(3))
                .andExpect(jsonPath("$.data.expires_at").doesNotExist());
    }

    @Test
    void getEntitlement_proUser_hasNoCardLimit() throws Exception {
        saveActiveSubscription(TEST_USER_ID, "token-pro", LocalDateTime.now().plusDays(20));

        mockMvc.perform(get("/api/billing/entitlement")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(true))
                .andExpect(jsonPath("$.data.store").value("GOOGLE_PLAY"))
                .andExpect(jsonPath("$.data.product_id").value(PRO_PRODUCT_ID))
                // card_limit 이 null 이면 무제한이라는 뜻 (설계 §3-1)
                .andExpect(jsonPath("$.data.card_limit").doesNotExist());
    }

    @Test
    void getEntitlement_expiredSubscription_isNotPro() throws Exception {
        // 만료 시각이 지났으면 status 가 ACTIVE 로 남아 있어도 프로가 아니다.
        saveActiveSubscription(TEST_USER_ID, "token-expired", LocalDateTime.now().minusDays(1));

        mockMvc.perform(get("/api/billing/entitlement")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(false))
                .andExpect(jsonPath("$.data.card_limit").value(3));
    }

    @Test
    void getEntitlement_otherUsersSubscription_doesNotLeak() throws Exception {
        // 남의 구독으로 내가 프로가 되면 안 된다.
        saveActiveSubscription(OTHER_USER_ID, "token-other", LocalDateTime.now().plusDays(20));

        mockMvc.perform(get("/api/billing/entitlement")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(false));
    }

    @Test
    void getEntitlement_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/billing/entitlement"))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────────── POST /api/billing/purchases/verify ───────────────────────

    @Test
    void verifyPurchase_validReceipt_grantsPro() throws Exception {
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        given(storeReceiptVerifier.verify(Store.GOOGLE_PLAY, PRO_PRODUCT_ID, "purchase-token-1"))
                .willReturn(VerifiedPurchase.builder()
                        .productId(PRO_PRODUCT_ID)
                        .purchaseToken("purchase-token-1")
                        .status(SubscriptionStatus.ACTIVE)
                        .expiresAt(expiresAt)
                        .autoRenewing(true)
                        .build());

        mockMvc.perform(post("/api/billing/purchases/verify")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "store": "GOOGLE_PLAY",
                                  "productId": "pro_monthly",
                                  "purchaseToken": "purchase-token-1"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.pro").value(true))
                .andExpect(jsonPath("$.data.product_id").value(PRO_PRODUCT_ID))
                .andExpect(jsonPath("$.data.card_limit").doesNotExist());

        assertThat(subscriptionRepository.findByStoreAndPurchaseToken(Store.GOOGLE_PLAY, "purchase-token-1"))
                .isPresent()
                .get()
                .extracting(SubscriptionEntity::getUserId, SubscriptionEntity::getStatus)
                .containsExactly(TEST_USER_ID, SubscriptionStatus.ACTIVE);
    }

    @Test
    void verifyPurchase_sameTokenTwice_isIdempotent() throws Exception {
        // 앱이 재시도해도 구독 행이 늘어나면 안 된다.
        given(storeReceiptVerifier.verify(any(), any(), any()))
                .willReturn(VerifiedPurchase.builder()
                        .productId(PRO_PRODUCT_ID)
                        .purchaseToken("purchase-token-2")
                        .status(SubscriptionStatus.ACTIVE)
                        .expiresAt(LocalDateTime.now().plusDays(30))
                        .autoRenewing(true)
                        .build());

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/billing/purchases/verify")
                            .header(HttpHeaders.AUTHORIZATION, bearerToken())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, "purchase-token-2")))
                    .andExpect(status().isOk());
        }

        assertThat(subscriptionRepository.findAll()).hasSize(1);
    }

    @Test
    void verifyPurchase_tokenBoundToAnotherUser_returnsConflict() throws Exception {
        // 같은 영수증을 다른 계정에 붙여 프로를 복제하는 시도 — 409 로 막는다.
        saveActiveSubscription(OTHER_USER_ID, "stolen-token", LocalDateTime.now().plusDays(30));
        given(storeReceiptVerifier.verify(any(), any(), any()))
                .willReturn(VerifiedPurchase.builder()
                        .productId(PRO_PRODUCT_ID)
                        .purchaseToken("stolen-token")
                        .status(SubscriptionStatus.ACTIVE)
                        .expiresAt(LocalDateTime.now().plusDays(30))
                        .autoRenewing(true)
                        .build());

        mockMvc.perform(post("/api/billing/purchases/verify")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, "stolen-token")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));

        // 원래 주인은 그대로여야 한다.
        assertThat(subscriptionRepository.findByStoreAndPurchaseToken(Store.GOOGLE_PLAY, "stolen-token"))
                .isPresent()
                .get()
                .extracting(SubscriptionEntity::getUserId)
                .isEqualTo(OTHER_USER_ID);
    }

    @Test
    void verifyPurchase_malformedToken_isRejectedBeforeCallingStore() throws Exception {
        // 영수증 값은 스토어 API 의 **URL 경로**에 들어간다. `/` 나 `..` 를 허용하면
        // 경로를 조작해 다른 패키지의 구매를 조회하게 만들 수 있다.
        // 그래서 서비스에 닿기 전에 형식으로 거른다.
        String[] malformed = {
                "../../../other-package/purchases/tokens/x",
                "token/with/slashes",
                "token?query=1",
                "token#fragment",
                "token{template}",
                " ",
        };

        for (String token : malformed) {
            mockMvc.perform(post("/api/billing/purchases/verify")
                            .header(HttpHeaders.AUTHORIZATION, bearerToken())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, token)))
                    .andExpect(status().isBadRequest());
        }

        // 걸러졌으므로 스토어 호출이 아예 일어나지 않아야 한다
        // (쓰레기 요청으로 외부 API 를 두들기게 만드는 것도 막는다).
        then(storeReceiptVerifier).shouldHaveNoInteractions();
        assertThat(subscriptionRepository.findAll()).isEmpty();
    }

    @Test
    void verifyPurchase_unknownProductId_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/billing/purchases/verify")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody("GOOGLE_PLAY", "not_a_real_product", "purchase-token-3")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void verifyPurchase_storeSaysNotActive_doesNotGrantPro() throws Exception {
        given(storeReceiptVerifier.verify(any(), any(), any()))
                .willReturn(VerifiedPurchase.builder()
                        .productId(PRO_PRODUCT_ID)
                        .purchaseToken("revoked-token")
                        .status(SubscriptionStatus.REVOKED)
                        .expiresAt(LocalDateTime.now().minusDays(1))
                        .autoRenewing(false)
                        .build());

        mockMvc.perform(post("/api/billing/purchases/verify")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, "revoked-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(false))
                .andExpect(jsonPath("$.data.card_limit").value(3));
    }

    @Test
    void verifyPurchase_storeNotConfigured_returnsServiceUnavailable() throws Exception {
        // 자격증명이 없으면 "통과"가 아니라 503 이어야 한다 (설계 §4-3).
        willThrow(new StoreUnavailableException("store not configured"))
                .given(storeReceiptVerifier).verify(any(), any(), any());

        mockMvc.perform(post("/api/billing/purchases/verify")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, "any-token")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.success").value(false));

        assertThat(subscriptionRepository.findAll()).isEmpty();
    }

    @Test
    void verifyPurchase_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/billing/purchases/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody("GOOGLE_PLAY", PRO_PRODUCT_ID, "any-token")))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────────────── 명함 등록 한도 ───────────────────────────

    @Test
    void createBusinessCard_freeUserWithinLimit_succeeds() throws Exception {
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);

        mockMvc.perform(multipart("/api/business-cards")
                        .file(payloadPart("세번째"))
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void createBusinessCard_freeUserOverLimit_returnsCardLimitExceeded() throws Exception {
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);

        mockMvc.perform(multipart("/api/business-cards")
                        .file(payloadPart("네번째"))
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                // 앱이 이 코드를 보고 결제 화면을 띄운다 (설계 §3-3)
                .andExpect(jsonPath("$.errorCode").value("CARD_LIMIT_EXCEEDED"));

        assertThat(businessCardRepository.findAll()).hasSize(3);
    }

    @Test
    void createBusinessCard_proUserOverFreeLimit_succeeds() throws Exception {
        saveActiveSubscription(TEST_USER_ID, "token-unlimited", LocalDateTime.now().plusDays(30));
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);

        mockMvc.perform(multipart("/api/business-cards")
                        .file(payloadPart("프로는무제한"))
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void deletedCards_doNotCountTowardLimit() throws Exception {
        // 삭제(비활성)된 명함이 한도를 계속 잡아먹으면 안 된다.
        saveCard(TEST_USER_ID);
        saveCard(TEST_USER_ID);
        BusinessCardEntity deleted = businessCardRepository.save(BusinessCardEntity.builder()
                .id(UUID.randomUUID().toString())
                .userId(TEST_USER_ID)
                .fullName("삭제된명함")
                .build());
        deleted.deactivate();
        businessCardRepository.save(deleted);

        mockMvc.perform(get("/api/billing/entitlement")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.card_count").value(2));
    }

    // ─────────────────────────── helpers ───────────────────────────

    private void saveUser(String userId) {
        userRepository.save(UserEntity.builder()
                .id(userId)
                .provider("kakao")
                .email(userId + "@example.com")
                .nickname(userId)
                .build());
    }

    private void saveCard(String userId) {
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .fullName("명함")
                .build());
    }

    private void saveActiveSubscription(String userId, String purchaseToken, LocalDateTime expiresAt) {
        subscriptionRepository.save(SubscriptionEntity.builder()
                .userId(userId)
                .store(Store.GOOGLE_PLAY)
                .productId(PRO_PRODUCT_ID)
                .purchaseToken(purchaseToken)
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(expiresAt)
                .autoRenewing(true)
                .build());
    }

    private MockMultipartFile payloadPart(String fullName) {
        return new MockMultipartFile(
                "payload",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                ("{\"full_name\": \"" + fullName + "\"}").getBytes(StandardCharsets.UTF_8)
        );
    }

    private String verifyBody(String store, String productId, String purchaseToken) {
        return """
                {
                  "store": "%s",
                  "productId": "%s",
                  "purchaseToken": "%s"
                }
                """.formatted(store, productId, purchaseToken);
    }

    private String bearerToken() {
        return "Bearer " + accessToken;
    }
}
