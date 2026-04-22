package com.businesscard.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.businesscard.auth.dto.AuthTokenResponse;
import com.businesscard.auth.service.AuthService;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.security.JwtTokenProvider;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.util.UriComponentsBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "file.upload-dir=build/test-uploads",
        "app.jwt.secret=test-jwt-secret-key-at-least-32-characters-long"
})
class ApiIntegrationTest {

    private static final String TEST_USER_ID = "kakao_100";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BusinessCardRepository businessCardRepository;

    @MockBean
    private AuthService authService;

    private final Path uploadRoot = Paths.get("build/test-uploads").toAbsolutePath().normalize();

    private String accessToken;

    @BeforeEach
    void setUp() {
        cleanUploadDirectory();
        businessCardRepository.deleteAll();
        userRepository.deleteAll();

        userRepository.save(UserEntity.builder()
                .id(TEST_USER_ID)
                .provider("kakao")
                .email("tester@example.com")
                .nickname("tester")
                .build());
        accessToken = jwtTokenProvider.createAccessToken(TEST_USER_ID);
    }

    @AfterEach
    void tearDown() {
        cleanUploadDirectory();
    }

    @Test
    void loginWithKakao_returnsTokenResponse() throws Exception {
        given(authService.loginWithKakaoAccessToken("kakao-access-token"))
                .willReturn(AuthTokenResponse.bearer("issued-jwt-token", 3600L, "kakao_200"));

        mockMvc.perform(post("/api/auth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "kakaoAccessToken": "kakao-access-token"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("issued-jwt-token"))
                .andExpect(jsonPath("$.data.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.data.expiresIn").value(3600))
                .andExpect(jsonPath("$.data.userId").value("kakao_200"));
    }

    @Test
    void syncUser_returnsUserResponse() throws Exception {
        mockMvc.perform(post("/api/users/sync")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "kakao_100",
                                  "provider": "kakao",
                                  "email": "updated@example.com",
                                  "nickname": "updated"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(TEST_USER_ID))
                .andExpect(jsonPath("$.data.email").value("updated@example.com"))
                .andExpect(jsonPath("$.data.nickname").value("updated"))
                .andExpect(jsonPath("$.data.provider").value("kakao"));
    }

    @Test
    void getBusinessCards_returnsList() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "홍길동", null);

        mockMvc.perform(get("/api/business-cards")
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(cardId))
                .andExpect(jsonPath("$.data[0].full_name").value("홍길동"));
    }

    @Test
    void getBusinessCard_returnsCard() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "이순신", null);

        mockMvc.perform(get("/api/business-cards/{cardId}", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(cardId))
                .andExpect(jsonPath("$.data.full_name").value("이순신"));
    }

    @Test
    void createBusinessCard_returnsCreatedId() throws Exception {
        MockMultipartFile payload = new MockMultipartFile(
                "payload",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                        {
                          "full_name": "김테스트",
                          "display_name": "테스트",
                          "phone": "010-1111-2222"
                        }
                        """.getBytes(StandardCharsets.UTF_8)
        );

        MockMultipartFile image = new MockMultipartFile(
                "businessCardImage",
                "profile.png",
                "image/png",
                new byte[]{1, 2, 3, 4}
        );

        MvcResult result = mockMvc.perform(multipart("/api/business-cards")
                        .file(payload)
                        .file(image)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andReturn();

        JsonNode json = readJson(result);
        String createdId = json.path("data").path("id").asText();
        assertThat(businessCardRepository.findById(createdId)).isPresent();
    }

    @Test
    void updateBusinessCard_returnsUpdatedId() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "수정전", null);

        MockMultipartFile payload = new MockMultipartFile(
                "payload",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                        {
                          "full_name": "수정후",
                          "display_name": "수정후"
                        }
                        """.getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/api/business-cards/{cardId}", cardId)
                        .file(payload)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken())
                        .with(request -> {
                            request.setMethod("PUT");
                            return request;
                        }))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(cardId));

        assertThat(businessCardRepository.findById(cardId))
                .isPresent()
                .get()
                .extracting(BusinessCardEntity::getFullName)
                .isEqualTo("수정후");
    }

    @Test
    void deleteBusinessCard_deactivatesCard() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "삭제대상", null);

        mockMvc.perform(delete("/api/business-cards/{cardId}", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(businessCardRepository.findById(cardId))
                .isPresent()
                .get()
                .extracting(BusinessCardEntity::isActive)
                .isEqualTo(false);
    }

    @Test
    void incrementViewCount_increasesCount() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "조회수", null);

        mockMvc.perform(post("/api/business-cards/{cardId}/view-count", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        assertThat(businessCardRepository.findById(cardId))
                .isPresent()
                .get()
                .extracting(BusinessCardEntity::getViewCount)
                .isEqualTo(1);
    }

    @Test
    void generateVcfDownloadUrl_returnsUrl() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "VCF테스트", null);

        mockMvc.perform(get("/api/business-cards/{cardId}/vcf-download-url", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value(containsString("/api/business-cards/" + cardId + "/downloads/vcf?token=")));
    }

    @Test
    void generateImageDownloadUrl_returnsUrl() throws Exception {
        String imagePath = createImageFile("image-url-card.png", new byte[]{9, 8, 7});
        String cardId = saveCard(TEST_USER_ID, "이미지URL테스트", imagePath);

        mockMvc.perform(get("/api/business-cards/{cardId}/image-download-url", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.url").value(containsString("/api/business-cards/" + cardId + "/downloads/image?token=")));
    }

    @Test
    void downloadVcf_returnsAttachmentWithoutAuth() throws Exception {
        String cardId = saveCard(TEST_USER_ID, "다운로드VCF", null);

        MvcResult tokenResult = mockMvc.perform(get("/api/business-cards/{cardId}/vcf-download-url", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andReturn();

        String downloadUrl = readJson(tokenResult).path("data").path("url").asText();
        String token = extractToken(downloadUrl);

        MvcResult downloadResult = mockMvc.perform(get("/api/business-cards/{cardId}/downloads/vcf", cardId)
                        .param("token", token))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("text/vcard")))
                .andReturn();

        String body = downloadResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("BEGIN:VCARD");
    }

    @Test
    void downloadImage_returnsAttachmentWithoutAuth() throws Exception {
        byte[] imageBytes = new byte[]{11, 22, 33, 44, 55};
        String imagePath = createImageFile("download-image-card.png", imageBytes);
        String cardId = saveCard(TEST_USER_ID, "다운로드이미지", imagePath);

        MvcResult tokenResult = mockMvc.perform(get("/api/business-cards/{cardId}/image-download-url", cardId)
                        .header(HttpHeaders.AUTHORIZATION, bearerToken()))
                .andExpect(status().isOk())
                .andReturn();

        String downloadUrl = readJson(tokenResult).path("data").path("url").asText();
        String token = extractToken(downloadUrl);

        MvcResult downloadResult = mockMvc.perform(get("/api/business-cards/{cardId}/downloads/image", cardId)
                        .param("token", token))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, containsString("attachment")))
                .andReturn();

        assertThat(downloadResult.getResponse().getContentAsByteArray()).isEqualTo(imageBytes);
    }

    private String saveCard(String userId, String fullName, String imagePath) {
        String cardId = UUID.randomUUID().toString();
        businessCardRepository.save(BusinessCardEntity.builder()
                .id(cardId)
                .userId(userId)
                .fullName(fullName)
                .displayName(fullName)
                .businessCardImagePath(imagePath)
                .build());
        return cardId;
    }

    private String createImageFile(String fileName, byte[] bytes) throws IOException {
        Path imageDir = uploadRoot.resolve("business-card-images");
        Files.createDirectories(imageDir);
        Path imagePath = imageDir.resolve(fileName);
        Files.write(imagePath, bytes);
        return "/uploads/business-card-images/" + fileName;
    }

    private String bearerToken() {
        return "Bearer " + accessToken;
    }

    private JsonNode readJson(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String extractToken(String url) {
        return UriComponentsBuilder.fromUriString(url)
                .build()
                .getQueryParams()
                .getFirst("token");
    }

    private void cleanUploadDirectory() {
        if (!Files.exists(uploadRoot)) {
            return;
        }

        try (var walk = Files.walk(uploadRoot)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
