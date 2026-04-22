package com.businesscard.card.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.businesscard.card.dto.BusinessCardIdResponse;
import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.dto.BusinessCardUpsertRequest;
import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.card.util.VCardGeneratorUtil;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.EntityNotFoundException;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@Service
@RequiredArgsConstructor
public class BusinessCardService {

    private static final int DOWNLOAD_TOKEN_TTL_MINUTES = 5;

    private final BusinessCardRepository businessCardRepository;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final VCardGeneratorUtil vCardGeneratorUtil;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

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

    @Transactional
    public BusinessCardIdResponse createBusinessCard(String userId, String payload, MultipartFile businessCardImage) {
        validateUserId(userId);
        BusinessCardUpsertRequest request = parseAndValidatePayload(payload);
        String cardId = request.getId() == null || request.getId().isBlank()
                ? UUID.randomUUID().toString()
                : request.getId();

        String imagePath = storeImage(cardId, businessCardImage);
        BusinessCardEntity entity = request.toEntity(cardId, userId, imagePath);
        businessCardRepository.save(entity);
        return new BusinessCardIdResponse(entity.getId());
    }

    @Transactional
    public BusinessCardIdResponse updateBusinessCard(
            String userId,
            String cardId,
            String payload,
            MultipartFile businessCardImage
    ) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        BusinessCardUpsertRequest request = parseAndValidatePayload(payload);

        String imagePath = card.getBusinessCardImagePath();
        if (businessCardImage != null && !businessCardImage.isEmpty()) {
            deleteImageIfExists(imagePath);
            imagePath = storeImage(cardId, businessCardImage);
        }

        card.updateFrom(request, imagePath);
        return new BusinessCardIdResponse(card.getId());
    }

    @Transactional
    public void deleteBusinessCard(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        card.deactivate();
    }

    @Transactional
    public void incrementViewCount(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);
        card.incrementViewCount();
    }

    @Transactional
    public DownloadUrlResponse generateVcfDownloadUrl(String userId, String cardId) {
        validateUserId(userId);
        BusinessCardEntity card = getOwnedActiveCard(userId, cardId);

        String token = UUID.randomUUID().toString();
        card.issueVcfToken(token, LocalDateTime.now().plusMinutes(DOWNLOAD_TOKEN_TTL_MINUTES));

        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
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

        String url = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/business-cards/")
                .path(cardId)
                .path("/downloads/image")
                .queryParam("token", token)
                .toUriString();
        return new DownloadUrlResponse(url);
    }

    @Transactional(readOnly = true)
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

    @Transactional(readOnly = true)
    public DownloadFile downloadImage(String cardId, String token) {
        BusinessCardEntity card = getActiveCard(cardId);
        if (!card.isImageTokenValid(token)) {
            throw new BusinessRuleException("이미지 다운로드 토큰이 유효하지 않습니다.");
        }
        if (card.getBusinessCardImagePath() == null || card.getBusinessCardImagePath().isBlank()) {
            throw new BusinessRuleException("명함 이미지가 존재하지 않습니다.");
        }

        Path imagePath = toPhysicalPath(card.getBusinessCardImagePath());
        if (!Files.exists(imagePath)) {
            throw new EntityNotFoundException("명함 이미지를 찾을 수 없습니다.");
        }

        try {
            String contentType = Files.probeContentType(imagePath);
            if (contentType == null || contentType.isBlank()) {
                contentType = "application/octet-stream";
            }
            String extension = extractExtension(imagePath.getFileName().toString());
            String fileName = buildDownloadFileName(card.getFullName(), extension);
            byte[] bytes = Files.readAllBytes(imagePath);
            return new DownloadFile(fileName, contentType, bytes);
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일을 읽을 수 없습니다.");
        }
    }

    private BusinessCardResponse toResponse(BusinessCardEntity entity) {
        String imageUrl = null;
        if (entity.getBusinessCardImagePath() != null && !entity.getBusinessCardImagePath().isBlank()) {
            imageUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                    .path(entity.getBusinessCardImagePath())
                    .toUriString();
        }
        String vcfUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
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

        String extension = extractExtension(image.getOriginalFilename());
        String fileName = cardId + "_" + System.currentTimeMillis() + "." + extension;
        Path imageDir = Paths.get(uploadDir, "business-card-images").toAbsolutePath().normalize();
        Path targetPath = imageDir.resolve(fileName).normalize();

        try {
            Files.createDirectories(imageDir);
            Files.copy(image.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            return "/uploads/business-card-images/" + fileName;
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일 저장에 실패했습니다.");
        }
    }

    private void deleteImageIfExists(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            return;
        }

        Path path = toPhysicalPath(imagePath);
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }

    private Path toPhysicalPath(String imagePath) {
        String normalized = imagePath.startsWith("/uploads/")
                ? imagePath.substring("/uploads/".length())
                : imagePath;
        return Paths.get(uploadDir)
                .toAbsolutePath()
                .normalize()
                .resolve(normalized)
                .normalize();
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

        Path physicalPath = toPhysicalPath(imagePath);
        if (!Files.exists(physicalPath)) {
            return VCardPhoto.empty();
        }

        try {
            byte[] imageBytes = Files.readAllBytes(physicalPath);
            if (imageBytes.length == 0) {
                return VCardPhoto.empty();
            }

            String extension = extractExtension(physicalPath.getFileName().toString());
            String photoType = toVCardPhotoType(extension);
            String encoded = Base64.getEncoder().encodeToString(imageBytes);
            return new VCardPhoto(photoType, encoded);
        } catch (IOException ignored) {
            return VCardPhoto.empty();
        }
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
