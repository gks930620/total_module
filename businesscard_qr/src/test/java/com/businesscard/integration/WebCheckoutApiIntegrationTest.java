package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.businesscard.auth.service.AuthService;
import com.businesscard.billing.dto.TossPayment;
import com.businesscard.billing.entity.WebOrderEntity;
import com.businesscard.billing.entity.WebOrderStatus;
import com.businesscard.billing.repository.WebOrderRepository;
import com.businesscard.billing.service.TossPaymentsException;
import com.businesscard.billing.service.TossPaymentsGateway;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.PaymentException;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.web.servlet.ResultActions;

/**
 * 웹 결제 — 프로 평생 이용권(한 번 결제하면 영구). 설계 {@code 설계/웹결제_설계.md}.
 *
 * <p>흐름: 주문 생성(서버가 금액을 정한다) → 토스 결제창 → 성공 주소로 돌아옴 → <b>서버가 토스에 승인 요청</b>.
 * 승인 전까지는 돈이 빠져나가지 않는다 — 그래서 승인 직전이 모든 검사의 자리다.
 *
 * <p>토스 API({@link TossPaymentsGateway})는 목으로 대체한다. 여기서 지키는 것은
 * "토스가 이렇게 답했을 때 우리가 권한을 주는가/안 주는가"라는 계약이다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads-web-checkout",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long",
        "app.billing.free-card-limit=3",
        "app.billing.web.lifetime-price=9900",
        "app.billing.toss.client-key=test_ck_dummy"
})
class WebCheckoutApiIntegrationTest {

    private static final String ME = "kakao_700";
    private static final String OTHER = "kakao_701";
    private static final long PRICE = 9900;
    private static final String LIFETIME = "pro_lifetime";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BusinessCardRepository businessCardRepository;

    @Autowired
    private WebOrderRepository webOrderRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private TossPaymentsGateway tossPaymentsGateway;

    @BeforeEach
    void setUp() {
        webOrderRepository.deleteAll();
        businessCardRepository.deleteAll();
        userRepository.deleteAll();
        saveUser(ME);
        saveUser(OTHER);
        given(tossPaymentsGateway.isConfigured()).willReturn(true);
    }

    // ─────────────────────────── GET /api/billing/web/lifetime ───────────────────────────

    @Test
    void offer_showsTheServerPrice() throws Exception {
        // 가격은 화면이 아니라 서버가 정한다 — 화면에 적힌 숫자를 고쳐도 결제 금액은 바뀌지 않는다.
        mockMvc.perform(get("/api/billing/web/lifetime").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.product_id").value(LIFETIME))
                .andExpect(jsonPath("$.data.amount").value(PRICE))
                .andExpect(jsonPath("$.data.currency").value("KRW"))
                .andExpect(jsonPath("$.data.available").value(true))
                // 첫 화면 요금 안내("무료 — 명함 3장까지")도 서버 설정을 따른다
                .andExpect(jsonPath("$.data.free_card_limit").value(3));
    }

    @Test
    void offer_isNotAvailable_untilPaymentsAreConfigured() throws Exception {
        // 키가 없으면 화면은 "결제 준비 중"을 보여준다. 눌러도 안 되는 결제 버튼을 두지 않는다.
        given(tossPaymentsGateway.isConfigured()).willReturn(false);

        mockMvc.perform(get("/api/billing/web/lifetime").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.available").value(false));
    }

    @Test
    void offer_isPublic_soTheFirstScreenCanShowThePrice() throws Exception {
        // 가격은 로그인 전에도 보여야 한다(첫 화면 요금 안내 — 결제대행사 심사도 "가격이 보이는가"를 본다).
        // 가격·판매 여부만 담겨 있어 공개해도 새는 것이 없다.
        mockMvc.perform(get("/api/billing/web/lifetime"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(PRICE));
    }

    // ─────────────────────────── POST /api/billing/web/orders ───────────────────────────

    @Test
    void createOrder_recordsAPendingOrderAtTheServerPrice() throws Exception {
        JsonNode data = data(createOrder(ME)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amount").value(PRICE))
                .andExpect(jsonPath("$.data.currency").value("KRW"))
                .andExpect(jsonPath("$.data.product_id").value(LIFETIME))
                // 브라우저가 토스 결제창을 여는 데 쓰는 공개 키. 비밀 키는 절대 내려가지 않는다.
                .andExpect(jsonPath("$.data.client_key").value("test_ck_dummy")));

        String orderId = data.path("order_id").asText();
        // 토스 규칙: 6~64자, 영문·숫자·-·_ 만.
        assertThat(orderId).matches("^[A-Za-z0-9_-]{6,64}$");
        assertThat(data.path("order_name").asText()).isNotBlank();

        WebOrderEntity order = webOrderRepository.findByOrderId(orderId).orElseThrow();
        assertThat(order.getStatus()).isEqualTo(WebOrderStatus.PENDING);
        assertThat(order.getUserId()).isEqualTo(ME);
        assertThat(order.getAmount()).isEqualTo(PRICE);
        assertThat(order.getProductId()).isEqualTo(LIFETIME);
    }

    @Test
    void createOrder_isRefused_whenAlreadyLifetime() throws Exception {
        // 영구 이용권을 두 번 사게 두지 않는다.
        savePaidOrder(ME, "pk_paid");

        createOrder(ME)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("ALREADY_LIFETIME"));
    }

    @Test
    void createOrder_isUnavailable_untilPaymentsAreConfigured() throws Exception {
        given(tossPaymentsGateway.isConfigured()).willReturn(false);

        createOrder(ME)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("PAYMENT_UNAVAILABLE"));
        assertThat(webOrderRepository.findAll()).isEmpty();
    }

    @Test
    void createOrder_requiresLogin() throws Exception {
        mockMvc.perform(post("/api/billing/web/orders")).andExpect(status().isUnauthorized());
    }

    // ─────────────────────── POST /api/billing/web/orders/{orderId}/confirm ───────────────────────

    @Test
    void confirm_grantsLifetimePro() throws Exception {
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE)).willReturn(done(orderId, "pk_1", PRICE));

        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(true))
                .andExpect(jsonPath("$.data.lifetime").value(true))
                .andExpect(jsonPath("$.data.product_id").value(LIFETIME))
                // 영구 — 만료일도 장수 한도도 없다
                .andExpect(jsonPath("$.data.expires_at").doesNotExist())
                .andExpect(jsonPath("$.data.card_limit").doesNotExist());

        WebOrderEntity order = webOrderRepository.findByOrderId(orderId).orElseThrow();
        assertThat(order.getStatus()).isEqualTo(WebOrderStatus.PAID);
        assertThat(order.getPaymentKey()).isEqualTo("pk_1");
        assertThat(order.getApprovedAt()).isNotNull();
    }

    @Test
    void confirm_letsTheUserCreateCardsBeyondTheFreeLimit() throws Exception {
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE)).willReturn(done(orderId, "pk_1", PRICE));
        confirm(ME, orderId, "pk_1", PRICE).andExpect(status().isOk());
        saveCard(ME);
        saveCard(ME);
        saveCard(ME);

        mockMvc.perform(multipart("/api/business-cards")
                        .file(payloadPart("네번째"))
                        .header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(status().isOk());
    }

    @Test
    void confirm_rejectsATamperedAmount_withoutAskingToss() throws Exception {
        // 성공 주소의 amount 는 브라우저를 거쳐 온다 — 100원으로 바꿔 와도 우리가 정한 금액과 다르면 승인하지 않는다.
        String orderId = newOrderId(ME);

        confirm(ME, orderId, "pk_1", 100)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PAYMENT_AMOUNT_MISMATCH"));

        then(tossPaymentsGateway).should(never()).confirm(anyString(), anyString(), anyLong());
        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PENDING);
    }

    @Test
    void confirm_someoneElsesOrder_isNotFound() throws Exception {
        // 남의 주문으로 내 계정에 권한을 붙일 수 없다. 존재 여부도 알리지 않는다(404).
        String othersOrder = newOrderId(OTHER);

        confirm(ME, othersOrder, "pk_1", PRICE).andExpect(status().isNotFound());

        then(tossPaymentsGateway).should(never()).confirm(anyString(), anyString(), anyLong());
    }

    @Test
    void confirm_unknownOrder_isNotFound() throws Exception {
        confirm(ME, "bq_no_such_order", "pk_1", PRICE).andExpect(status().isNotFound());
    }

    @Test
    void confirm_twice_asksTossOnce() throws Exception {
        // 성공 화면 새로고침·뒤로가기로 승인 요청이 다시 와도 결제는 한 번이다.
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE)).willReturn(done(orderId, "pk_1", PRICE));

        confirm(ME, orderId, "pk_1", PRICE).andExpect(status().isOk());
        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifetime").value(true));

        then(tossPaymentsGateway).should(times(1)).confirm(anyString(), anyString(), anyLong());
    }

    @Test
    void confirm_secondOrder_whenAlreadyLifetime_isNotCharged() throws Exception {
        // 탭 두 개에서 각각 결제창을 열었다가 둘 다 결제한 경우. 두 번째는 승인하지 않는다 —
        // 토스는 승인되지 않은 결제를 10분 뒤 자동으로 취소하므로 돈이 두 번 빠지지 않는다.
        String first = newOrderId(ME);
        String second = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", first, PRICE)).willReturn(done(first, "pk_1", PRICE));
        confirm(ME, first, "pk_1", PRICE).andExpect(status().isOk());

        confirm(ME, second, "pk_2", PRICE)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("ALREADY_LIFETIME"));

        then(tossPaymentsGateway).should(never()).confirm(eq("pk_2"), anyString(), anyLong());
    }

    @Test
    void confirm_cardRejected_leavesTheOrderPending() throws Exception {
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE))
                .willThrow(new TossPaymentsException(403, "REJECT_CARD_COMPANY", "카드사에서 결제를 거절했습니다."));

        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("PAYMENT_REJECTED"))
                // 토스의 안내 문장은 사용자에게 보여주라고 만든 것이다 — 그대로 전한다.
                .andExpect(jsonPath("$.message").value("카드사에서 결제를 거절했습니다."));

        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PENDING);
        mockMvc.perform(get("/api/billing/entitlement").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(jsonPath("$.data.pro").value(false));
    }

    @Test
    void confirm_tossUnreachable_returns503_andCanBeRetried() throws Exception {
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE))
                .willThrow(PaymentException.unavailable("토스 응답 없음"))
                .willReturn(done(orderId, "pk_1", PRICE));

        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("PAYMENT_UNAVAILABLE"));
        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifetime").value(true));
    }

    @Test
    void confirm_alreadyProcessedAtToss_recoversByLookingItUp() throws Exception {
        // 토스는 승인했는데 그 응답을 우리가 못 받은 경우(서버 재시작 등) — 다시 승인하면 "이미 처리됨"이 온다.
        // 그때는 토스에 결제를 조회해 실제로 끝난 결제면 권한을 준다.
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE))
                .willThrow(new TossPaymentsException(400, "ALREADY_PROCESSED_PAYMENT", "이미 처리된 결제 입니다."));
        given(tossPaymentsGateway.getPayment("pk_1")).willReturn(done(orderId, "pk_1", PRICE));

        confirm(ME, orderId, "pk_1", PRICE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lifetime").value(true));
    }

    @Test
    void confirm_tossAnswerNotMatchingTheOrder_grantsNothing() throws Exception {
        // 토스 응답의 주문번호·금액이 우리 주문과 다르면 권한을 주지 않는다(다른 주문의 결제를 끌어다 쓰는 것 차단).
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.confirm("pk_1", orderId, PRICE)).willReturn(done("bq_other_order", "pk_1", PRICE));

        confirm(ME, orderId, "pk_1", PRICE).andExpect(status().isBadRequest());

        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PENDING);
    }

    @Test
    void confirm_malformedPaymentKey_isRejectedBeforeAskingToss() throws Exception {
        String orderId = newOrderId(ME);

        confirm(ME, orderId, "../../v1/billing", PRICE).andExpect(status().isBadRequest());
        confirm(ME, orderId, "", PRICE).andExpect(status().isBadRequest());

        then(tossPaymentsGateway).should(never()).confirm(anyString(), anyString(), anyLong());
    }

    @Test
    void confirm_requiresLogin() throws Exception {
        mockMvc.perform(post("/api/billing/web/orders/{id}/confirm", "bq_x")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(confirmBody("pk_1", PRICE)))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────────────── POST /api/billing/web/webhook ───────────────────────────
    // 토스가 결제 상태가 바뀔 때 부르는 주소. 운영자가 토스 관리자 화면에서 환불하면 여기로 알려 온다.
    // 누구나 부를 수 있는 주소라서, 본문은 "바뀐 게 있다"는 신호로만 쓰고 실제 상태는 토스에 직접 묻는다.

    @Test
    void webhook_refund_revokesLifetime() throws Exception {
        String orderId = savePaidOrder(ME, "pk_paid");
        given(tossPaymentsGateway.getPayment("pk_paid")).willReturn(payment(orderId, "pk_paid", "CANCELED", PRICE));

        webhook(orderId, "pk_paid", "CANCELED").andExpect(status().isOk());

        WebOrderEntity order = webOrderRepository.findByOrderId(orderId).orElseThrow();
        assertThat(order.getStatus()).isEqualTo(WebOrderStatus.CANCELED);
        assertThat(order.getCanceledAt()).isNotNull();
        mockMvc.perform(get("/api/billing/entitlement").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(jsonPath("$.data.pro").value(false))
                .andExpect(jsonPath("$.data.card_limit").value(3));
    }

    @Test
    void webhook_forgedCancel_isIgnored_becauseTossIsAsked() throws Exception {
        String orderId = savePaidOrder(ME, "pk_paid");
        given(tossPaymentsGateway.getPayment("pk_paid")).willReturn(done(orderId, "pk_paid", PRICE));

        webhook(orderId, "pk_paid", "CANCELED").andExpect(status().isOk());

        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PAID);
    }

    @Test
    void webhook_paidButConfirmResponseLost_isRecorded() throws Exception {
        // 승인 직후 사용자가 창을 닫아 성공 화면이 우리에게 못 알린 경우에도 결제가 반영된다.
        String orderId = newOrderId(ME);
        given(tossPaymentsGateway.getPayment("pk_1")).willReturn(done(orderId, "pk_1", PRICE));

        webhook(orderId, "pk_1", "DONE").andExpect(status().isOk());

        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PAID);
    }

    @Test
    void webhook_unknownOrder_isIgnoredWithoutAskingToss() throws Exception {
        webhook("bq_no_such_order", "pk_1", "DONE").andExpect(status().isOk());

        then(tossPaymentsGateway).should(never()).getPayment(any());
    }

    @Test
    void webhook_tossUnreachable_asksTossToRetry() throws Exception {
        // 200 이 아니면 토스가 나중에 다시 보낸다(최대 7회). 확인하지 못한 채 200 을 주면 그 소식은 영영 사라진다.
        String orderId = savePaidOrder(ME, "pk_paid");
        given(tossPaymentsGateway.getPayment("pk_paid")).willThrow(PaymentException.unavailable("토스 응답 없음"));

        webhook(orderId, "pk_paid", "CANCELED").andExpect(status().isServiceUnavailable());

        assertThat(webOrderRepository.findByOrderId(orderId).orElseThrow().getStatus()).isEqualTo(WebOrderStatus.PAID);
    }

    // ─────────────────────────── GET /api/billing/entitlement ───────────────────────────

    @Test
    void entitlement_lifetimeUser_isProWithoutExpiry() throws Exception {
        savePaidOrder(ME, "pk_paid");

        mockMvc.perform(get("/api/billing/entitlement").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pro").value(true))
                .andExpect(jsonPath("$.data.lifetime").value(true))
                .andExpect(jsonPath("$.data.product_id").value(LIFETIME))
                .andExpect(jsonPath("$.data.expires_at").doesNotExist())
                .andExpect(jsonPath("$.data.card_limit").doesNotExist());
    }

    @Test
    void entitlement_pendingOrder_isNotPro() throws Exception {
        // 주문만 만들고 결제하지 않았다면 프로가 아니다.
        newOrderId(ME);

        mockMvc.perform(get("/api/billing/entitlement").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(jsonPath("$.data.pro").value(false))
                .andExpect(jsonPath("$.data.lifetime").value(false));
    }

    @Test
    void entitlement_othersLifetime_doesNotLeak() throws Exception {
        savePaidOrder(OTHER, "pk_other");

        mockMvc.perform(get("/api/billing/entitlement").header(HttpHeaders.AUTHORIZATION, bearer(ME)))
                .andExpect(jsonPath("$.data.pro").value(false));
    }

    // ─────────────────────────── helpers ───────────────────────────

    private ResultActions createOrder(String userId) throws Exception {
        return mockMvc.perform(post("/api/billing/web/orders").header(HttpHeaders.AUTHORIZATION, bearer(userId)));
    }

    private String newOrderId(String userId) throws Exception {
        return data(createOrder(userId).andExpect(status().isOk())).path("order_id").asText();
    }

    private ResultActions confirm(String userId, String orderId, String paymentKey, long amount) throws Exception {
        return mockMvc.perform(post("/api/billing/web/orders/{id}/confirm", orderId)
                .header(HttpHeaders.AUTHORIZATION, bearer(userId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(confirmBody(paymentKey, amount)));
    }

    private String confirmBody(String paymentKey, long amount) {
        return """
                {"payment_key": "%s", "amount": %d}
                """.formatted(paymentKey, amount);
    }

    /** 토스 웹훅 본문 형식 그대로(PAYMENT_STATUS_CHANGED). 로그인 없이 온다. */
    private ResultActions webhook(String orderId, String paymentKey, String status) throws Exception {
        String body = """
                {
                  "eventType": "PAYMENT_STATUS_CHANGED",
                  "createdAt": "2026-11-24T10:00:00.000000",
                  "data": {"paymentKey": "%s", "orderId": "%s", "status": "%s", "totalAmount": %d}
                }
                """.formatted(paymentKey, orderId, status, PRICE);
        return mockMvc.perform(post("/api/billing/web/webhook")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private JsonNode data(ResultActions result) throws Exception {
        String json = result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return objectMapper.readTree(json).path("data");
    }

    private String savePaidOrder(String userId, String paymentKey) {
        WebOrderEntity order = WebOrderEntity.pending(userId, LIFETIME, PRICE);
        order.markPaid(paymentKey, "카드", LocalDateTime.now());
        return webOrderRepository.save(order).getOrderId();
    }

    private TossPayment done(String orderId, String paymentKey, long amount) {
        return payment(orderId, paymentKey, "DONE", amount);
    }

    private TossPayment payment(String orderId, String paymentKey, String status, long amount) {
        return TossPayment.builder()
                .paymentKey(paymentKey)
                .orderId(orderId)
                .status(status)
                .totalAmount(amount)
                .method("카드")
                .approvedAt(LocalDateTime.now())
                .build();
    }

    private String bearer(String userId) {
        return "Bearer " + jwtTokenProvider.createAccessToken(userId);
    }

    private void saveUser(String userId) {
        userRepository.save(UserEntity.builder().id(userId).provider("kakao").build());
    }

    private void saveCard(String userId) {
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .fullName("명함")
                .build());
    }

    private MockMultipartFile payloadPart(String fullName) {
        return new MockMultipartFile("payload", "", MediaType.APPLICATION_JSON_VALUE,
                ("{\"full_name\": \"" + fullName + "\"}").getBytes(StandardCharsets.UTF_8));
    }
}
