package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import com.businesscard.billing.entity.Store;
import com.businesscard.billing.entity.SubscriptionEntity;
import com.businesscard.billing.entity.SubscriptionStatus;
import com.businesscard.billing.repository.SubscriptionRepository;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.card.storage.FileStorage;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 회원 탈퇴(계정 삭제) API.
 *
 * <p><b>왜 필요한가:</b> Google Play 는 계정을 만들 수 있는 앱에 대해
 * <b>앱 안에서의 계정 삭제 수단</b>과 웹 삭제 요청 경로를 요구한다. 없으면 심사에서 막힌다.
 *
 * <p>보관 정책은 {@code static/privacy.html} §3 과 일치해야 한다 —
 * 계정·명함은 즉시 파기하되 <b>결제 기록은 전자상거래법상 5년 보관</b>이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-account",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long"
})
class AccountDeletionApiIntegrationTest {

    private static final String TEST_USER_ID = "kakao_700";
    private static final String OTHER_USER_ID = "kakao_701";

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

    @Autowired
    private FileStorage fileStorage;

    @MockBean
    private AuthService authService;

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

    @Test
    void deleteAccount_removesUserAndCards() throws Exception {
        saveCard(TEST_USER_ID, null);
        saveCard(TEST_USER_ID, null);

        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(userRepository.findById(TEST_USER_ID)).isEmpty();
        assertThat(businessCardRepository.findAll()).isEmpty();
    }

    @Test
    void deleteAccount_deletesStoredImages() throws Exception {
        String imagePath = fileStorage.store(
                "business-card-images/" + UUID.randomUUID() + ".png",
                new byte[]{1, 2, 3},
                "image/png");
        saveCard(TEST_USER_ID, imagePath);

        assertThat(fileStorage.load(imagePath)).isPresent();

        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk());

        // 명함 행만 지우고 파일을 남기면 버킷에 orphan 이 쌓인다(코드컨벤션 §5-3-1).
        assertThat(fileStorage.load(imagePath)).isEmpty();
    }

    @Test
    void deleteAccount_keepsPaymentRecords() throws Exception {
        // 결제 기록은 전자상거래법상 5년 보관 의무가 있어 탈퇴해도 남는다 (개인정보처리방침 §3).
        subscriptionRepository.save(SubscriptionEntity.builder()
                .userId(TEST_USER_ID)
                .store(Store.GOOGLE_PLAY)
                .productId("pro_monthly")
                .purchaseToken("kept-after-withdrawal")
                .status(SubscriptionStatus.ACTIVE)
                .expiresAt(LocalDateTime.now().plusDays(10))
                .autoRenewing(true)
                .build());

        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk());

        assertThat(subscriptionRepository.findByStoreAndPurchaseToken(Store.GOOGLE_PLAY, "kept-after-withdrawal"))
                .isPresent();
    }

    @Test
    void deleteAccount_doesNotTouchOtherUsers() throws Exception {
        saveCard(TEST_USER_ID, null);
        String otherCardId = saveCard(OTHER_USER_ID, null);

        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk());

        assertThat(userRepository.findById(OTHER_USER_ID)).isPresent();
        assertThat(businessCardRepository.findById(otherCardId)).isPresent();
    }

    @Test
    void deleteAccount_invalidatesTokenImmediately() throws Exception {
        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk());

        // 탈퇴하면 아직 만료되지 않은 토큰도 즉시 못 쓰게 된다 —
        // JwtAuthenticationFilter 가 사용자 존재를 확인하기 때문. 재시도해도 500 이 아니라 401 이다.
        mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isUnauthorized());

        // 다른 API 도 마찬가지로 막혀야 한다(탈퇴한 계정이 계속 활동하면 안 된다).
        mockMvc.perform(get("/api/business-cards")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteAccount_clearsWebSessionCookies() throws Exception {
        // 웹은 쿠키로 로그인한다. 탈퇴 후 토큰은 어차피 무효(사용자가 없음)지만,
        // 쿠키가 남아 있으면 브라우저가 계속 실어 보내고 화면은 "로그인 상태"로 착각한다.
        org.springframework.test.web.servlet.MvcResult result = mockMvc.perform(delete("/api/users/me")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(result.getResponse().getHeaders(HttpHeaders.SET_COOKIE))
                .anySatisfy(value -> assertThat(value).startsWith("bq_access=").contains("Max-Age=0"))
                .anySatisfy(value -> assertThat(value).startsWith("bq_refresh=").contains("Max-Age=0"));
    }

    @Test
    void deleteAccount_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/users/me"))
                .andExpect(status().isUnauthorized());

        assertThat(userRepository.findById(TEST_USER_ID)).isPresent();
    }

    private void saveUser(String userId) {
        userRepository.save(UserEntity.builder()
                .id(userId)
                .provider("kakao")
                .email(userId + "@example.com")
                .nickname(userId)
                .build());
    }

    private String saveCard(String userId, String imagePath) {
        String cardId = UUID.randomUUID().toString();
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(cardId)
                .userId(userId)
                .fullName("명함")
                .businessCardImagePath(imagePath)
                .build());
        return cardId;
    }

    private String bearerToken() {
        return "Bearer " + accessToken;
    }
}
