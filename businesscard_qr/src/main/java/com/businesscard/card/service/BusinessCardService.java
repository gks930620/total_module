package com.businesscard.card.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.businesscard.card.dto.BusinessCardIdResponse;
import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.dto.BusinessCardUpsertRequest;
import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.card.storage.FileStorage;
import com.businesscard.card.storage.StoredFile;
import com.businesscard.card.support.PublicUrlResolver;
import com.businesscard.card.util.VCardGeneratorUtil;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.DuplicateResourceException;
import com.businesscard.common.exception.EntityNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class BusinessCardService {

    private static final int DOWNLOAD_TOKEN_TTL_MINUTES = 5;
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp");

    private final BusinessCardRepository businessCardRepository;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final VCardGeneratorUtil vCardGeneratorUtil;
    private final FileStorage fileStorage;
    private final PublicUrlResolver publicUrlResolver;

    @Transactional(readOnly = true)
    public List<BusinessCardResponse> getBusinessCards(String userId) {
        validateUserId(userId);
        return businessCardRepository.findByUserIdAndIsActiveTrueOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public BusinessCardResponse getBusinessCard(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        return toResponse(card);
    }

    /**
     * 명함 생성.
     *
     * <p>버킷 업로드(외부 네트워크 I/O)를 트랜잭션 안에서 하지 않는다 — 코드컨벤션 §1.
     * 느린 버킷 호출이 DB 커넥션을 붙잡으면 커넥션 풀이 고갈된다. DB 저장은 명시적 save 라
     * 별도 트랜잭션이 필요 없다. (저장 실패 시 업로드된 이미지는 orphan 으로 남지만,
     * 데이터가 사라지는 것보다 안전하다)
     */
    public BusinessCardIdResponse createBusinessCard(String userId, String payload, MultipartFile businessCardImage) {
        validateUserId(userId);
        BusinessCardUpsertRequest request = parseAndValidatePayload(payload);
        String cardId = resolveCardId(request.getId());

        String imagePath = storeImage(cardId, businessCardImage);
        BusinessCardEntity entity = request.toEntity(cardId, userId, imagePath);
        businessCardRepository.save(entity);
        return new BusinessCardIdResponse(entity.getId());
    }

    /**
     * 명함 수정.
     *
     * <p>① 버킷 I/O 는 트랜잭션 밖(코드컨벤션 §1). DB 갱신은 dirty checking 대신 <b>명시적 save</b>.
     * <p>② 이미지 교체 시 <b>새 이미지를 먼저 저장하고, DB 갱신까지 성공한 뒤에</b> 옛 이미지를 지운다.
     * 먼저 지우면(구 구현) 저장/갱신이 실패했을 때 DB 는 롤백돼 옛 경로를 가리키는데 파일은 이미
     * 사라져서 <b>원본이 복구 불가능하게 유실</b>된다.
     */
    public BusinessCardIdResponse updateBusinessCard(
            String userId,
            String cardId,
            String payload,
            MultipartFile businessCardImage
    ) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        BusinessCardUpsertRequest request = parseAndValidatePayload(payload);

        String oldImagePath = card.getBusinessCardImagePath();
        String imagePath = oldImagePath;
        boolean imageReplaced = businessCardImage != null && !businessCardImage.isEmpty();
        if (imageReplaced) {
            imagePath = storeImage(cardId, businessCardImage); // 새 이미지 먼저 저장
        }

        card.updateFrom(request, imagePath);
        businessCardRepository.save(card);

        if (imageReplaced) {
            deleteImageIfExists(oldImagePath); // 성공한 뒤에야 옛 이미지 삭제
        }
        return new BusinessCardIdResponse(card.getId());
    }

    @Transactional
    public void deleteBusinessCard(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        card.deactivate();
    }

    @Transactional
    public void incrementViewCount(String cardId) {
        // 조회수는 카드를 "본" 사람이 올리는 값이므로 소유자/인증으로 제한하지 않는다.
        // QR을 스캔한 비로그인 방문자도 활성 카드이기만 하면 조회수를 증가시킬 수 있다.
        // 동시 스캔 시 갱신 유실(lost update)이 없도록 DB에서 원자적으로 증가시킨다.
        int updated = businessCardRepository.incrementViewCount(cardId);
        if (updated == 0) {
            throw EntityNotFoundException.of("명함", cardId);
        }
    }

    @Transactional
    public DownloadUrlResponse generateVcfDownloadUrl(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);

        String token = UUID.randomUUID().toString();
        card.issueVcfToken(token, LocalDateTime.now().plusMinutes(DOWNLOAD_TOKEN_TTL_MINUTES));

        String url = publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(cardId)
                .path("/downloads/vcf")
                .queryParam("token", token)
                .toUriString();
        return new DownloadUrlResponse(url);
    }

    @Transactional
    public DownloadUrlResponse generateImageDownloadUrl(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        if (card.getBusinessCardImagePath() == null || card.getBusinessCardImagePath().isBlank()) {
            throw new BusinessRuleException("명함 이미지가 존재하지 않습니다.");
        }

        String token = UUID.randomUUID().toString();
        card.issueImageToken(token, LocalDateTime.now().plusMinutes(DOWNLOAD_TOKEN_TTL_MINUTES));

        String url = publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(cardId)
                .path("/downloads/image")
                .queryParam("token", token)
                .toUriString();
        return new DownloadUrlResponse(url);
    }

    /** vCard 다운로드. 버킷 GET(사진 로드)이 있어 트랜잭션을 걸지 않는다 — 코드컨벤션 §1. (읽기 전용이라 트랜잭션 불필요) */
    public DownloadFile downloadVcf(String cardId, String token) {
        BusinessCardEntity card = getActiveCard(cardId);
        if (!card.isVcfTokenValid(token)) {
            throw new BusinessRuleException("VCF 다운로드 토큰이 유효하지 않습니다.");
        }

        VCardPhoto photo = loadVCardPhoto(card.getBusinessCardImagePath());
        String fileName = buildDownloadFileName(card.getFullName(), "vcf");
        byte[] content = vCardGeneratorUtil
                .generateVCard(card, photo.type(), photo.base64())
                .getBytes(StandardCharsets.UTF_8);
        return new DownloadFile(fileName, "text/vcard; charset=UTF-8", content);
    }

    /** 이미지 다운로드. 버킷 GET 이 있어 트랜잭션을 걸지 않는다 — 코드컨벤션 §1. (읽기 전용이라 트랜잭션 불필요) */
    public DownloadFile downloadImage(String cardId, String token) {
        BusinessCardEntity card = getActiveCard(cardId);
        if (!card.isImageTokenValid(token)) {
            throw new BusinessRuleException("이미지 다운로드 토큰이 유효하지 않습니다.");
        }
        String imagePath = card.getBusinessCardImagePath();
        if (imagePath == null || imagePath.isBlank()) {
            throw new BusinessRuleException("명함 이미지가 존재하지 않습니다.");
        }

        StoredFile stored = fileStorage.load(imagePath)
                .orElseThrow(() -> new EntityNotFoundException("명함 이미지를 찾을 수 없습니다."));

        String contentType = stored.contentType() == null || stored.contentType().isBlank()
                ? "application/octet-stream"
                : stored.contentType();
        String extension = extractExtension(fileNameOf(imagePath));
        String fileName = buildDownloadFileName(card.getFullName(), extension);
        return new DownloadFile(fileName, contentType, stored.bytes());
    }

    private BusinessCardResponse toResponse(BusinessCardEntity entity) {
        String imageUrl = null;
        if (entity.getBusinessCardImagePath() != null && !entity.getBusinessCardImagePath().isBlank()) {
            imageUrl = publicUrlResolver.baseUriBuilder()
                    .path(entity.getBusinessCardImagePath())
                    .toUriString();
        }
        String vcfUrl = publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(entity.getId())
                .path("/vcf-download-url")
                .toUriString();

        return BusinessCardResponse.from(entity, imageUrl, vcfUrl);
    }

    private BusinessCardEntity getOwnedActiveCard(String userId, String cardId) {
        return businessCardRepository.findByIdAndUserIdAndIsActiveTrue(cardId, userId)
                .orElseThrow(() -> EntityNotFoundException.of("명함", cardId));
    }

    private BusinessCardEntity getActiveCard(String cardId) {
        return businessCardRepository.findByIdAndIsActiveTrue(cardId)
                .orElseThrow(() -> EntityNotFoundException.of("명함", cardId));
    }

    private void validateUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessRuleException("Authenticated user id is required.");
        }
    }

    /**
     * 명함 id 결정.
     *
     * <p>클라이언트가 id를 지정하지 않으면 서버가 UUID를 생성한다.
     * 지정한 경우에는 반드시 UUID 형식이어야 한다 —
     * (1) 이미지 파일명(`<cardId>_<timestamp>`)의 "추측 어려움" 전제를 유지하고,
     * (2) 오프라인 우선 클라이언트가 미리 생성한 UUID는 그대로 허용하기 위함.
     *
     * <p>또한 이미 존재하는 id인지 검사한다. {@code BusinessCardEntity}는 assigned id를
     * 쓰므로 {@code JpaRepository.save()}가 {@code merge()}로 동작한다. 즉 존재하는 id로
     * 생성하면 PK 충돌 500이 아니라 <b>다른 사용자의 카드를 조용히 덮어쓴다</b>(소유권 탈취).
     * 이를 막기 위해 생성 시점에 존재 여부를 확인하고 충돌 시 409로 응답한다.
     */
    private String resolveCardId(String requestedId) {
        if (requestedId == null || requestedId.isBlank()) {
            return UUID.randomUUID().toString();
        }
        String cardId;
        try {
            cardId = UUID.fromString(requestedId.trim()).toString();
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("id는 UUID 형식이어야 합니다.");
        }
        if (businessCardRepository.existsById(cardId)) {
            throw DuplicateResourceException.alreadyExists("이미 존재하는 명함 id입니다.");
        }
        return cardId;
    }

    private BusinessCardUpsertRequest parseAndValidatePayload(String payload) {
        if (payload == null || payload.isBlank()) {
            throw new BusinessRuleException("payload는 필수입니다.");
        }

        BusinessCardUpsertRequest request;
        try {
            request = objectMapper.readValue(payload, BusinessCardUpsertRequest.class);
        } catch (JsonProcessingException e) {
            throw new BusinessRuleException("payload JSON 형식이 올바르지 않습니다.");
        }

        Set<ConstraintViolation<BusinessCardUpsertRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            throw new BusinessRuleException(violations.iterator().next().getMessage());
        }
        return request;
    }

    private String storeImage(String cardId, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return null;
        }

        validateImageContentType(image);
        String extension = extractExtension(image.getOriginalFilename());
        String fileName = cardId + "_" + System.currentTimeMillis() + "." + extension;

        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일 저장에 실패했습니다.");
        }
        return fileStorage.store("business-card-images/" + fileName, bytes, image.getContentType());
    }

    private void validateImageContentType(MultipartFile image) {
        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new BusinessRuleException("이미지 파일만 업로드할 수 있습니다.");
        }
        String extension = extractExtension(image.getOriginalFilename());
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new BusinessRuleException("지원하지 않는 이미지 형식입니다.");
        }
    }

    private void deleteImageIfExists(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            return;
        }
        fileStorage.delete(imagePath);
    }

    private String fileNameOf(String logicalPath) {
        int slash = logicalPath.lastIndexOf('/');
        return slash >= 0 ? logicalPath.substring(slash + 1) : logicalPath;
    }

    private String extractExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "jpg";
        }

        String extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        if (!extension.matches("[a-z0-9]{1,10}")) {
            return "jpg";
        }
        return extension;
    }

    private String buildDownloadFileName(String fullName, String extension) {
        String safeName = fullName == null ? "business_card" : fullName.replaceAll("[^a-zA-Z0-9가-힣]", "_");
        String normalizedExtension = extension.startsWith(".") ? extension.substring(1) : extension;
        return safeName + "_business_card." + normalizedExtension;
    }

    private VCardPhoto loadVCardPhoto(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            return VCardPhoto.empty();
        }

        // vCard 생성은 사진 없이도 성공해야 하므로 로드 실패는 조용히 무시한다.
        Optional<StoredFile> stored;
        try {
            stored = fileStorage.load(imagePath);
        } catch (RuntimeException ignored) {
            return VCardPhoto.empty();
        }
        if (stored.isEmpty() || stored.get().bytes().length == 0) {
            return VCardPhoto.empty();
        }

        String extension = extractExtension(fileNameOf(imagePath));
        String photoType = toVCardPhotoType(extension);
        String encoded = Base64.getEncoder().encodeToString(stored.get().bytes());
        return new VCardPhoto(photoType, encoded);
    }

    private String toVCardPhotoType(String extension) {
        return switch (extension.toLowerCase()) {
            case "jpg", "jpeg" -> "JPEG";
            case "png" -> "PNG";
            case "gif" -> "GIF";
            case "bmp" -> "BMP";
            case "webp" -> "WEBP";
            default -> "JPEG";
        };
    }

    private record VCardPhoto(String type, String base64) {
        private static VCardPhoto empty() {
            return new VCardPhoto(null, null);
        }
    }
}
