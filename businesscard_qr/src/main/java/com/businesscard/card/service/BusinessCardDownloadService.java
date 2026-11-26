package com.businesscard.card.service;

import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.storage.FileStorage;
import com.businesscard.card.storage.StoredFile;
import com.businesscard.card.support.BusinessCardFinder;
import com.businesscard.card.support.CardImageStorage;
import com.businesscard.common.web.PublicUrlResolver;
import com.businesscard.card.util.VCardGeneratorUtil;
import com.businesscard.card.util.VCardPhotoLoader;
import com.businesscard.common.exception.BusinessRuleException;
import com.businesscard.common.exception.EntityNotFoundException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 명함 파일 내려받기 — 짧은 수명 토큰 발급과, 그 토큰으로 실제 파일을 만들어 주는 일.
 *
 * <p><b>왜 CRUD 서비스와 나눠 두나:</b> 접근 통제 방식이 다르다.
 * CRUD 는 "로그인한 소유자만" 이지만, 다운로드는 <b>QR 을 스캔한 비로그인 방문자</b>가
 * 대상이라 인증 대신 <b>토큰</b>으로 통제한다. 두 규칙을 한 클래스에 두면
 * 어느 메서드가 어느 규칙인지 헷갈려 소유자 검증이 빠지기 쉽다.
 */
@Service
@RequiredArgsConstructor
public class BusinessCardDownloadService {

    /**
     * 다운로드 토큰 수명. 링크를 받아 바로 여는 용도라 짧게 잡는다 —
     * 길면 유출된 URL 로 오래 내려받을 수 있다.
     */
    private static final int TOKEN_TTL_MINUTES = 5;

    private final BusinessCardFinder businessCardFinder;
    private final FileStorage fileStorage;
    private final CardImageStorage cardImageStorage;
    private final VCardGeneratorUtil vCardGeneratorUtil;
    private final VCardPhotoLoader vCardPhotoLoader;
    private final PublicUrlResolver publicUrlResolver;

    // ── 토큰 발급 (소유자만) ────────────────────────────────

    @Transactional
    public DownloadUrlResponse issueVcfDownloadUrl(String userId, String cardId) {
        BusinessCardEntity card = businessCardFinder.ownedActive(userId, cardId);
        String token = newToken();
        card.issueVcfToken(token, expiresAt());
        return new DownloadUrlResponse(downloadUrl(cardId, "vcf", token));
    }

    @Transactional
    public DownloadUrlResponse issueImageDownloadUrl(String userId, String cardId) {
        BusinessCardEntity card = businessCardFinder.ownedActive(userId, cardId);
        if (!hasImage(card)) {
            throw new BusinessRuleException("명함 이미지가 존재하지 않습니다.");
        }
        String token = newToken();
        card.issueImageToken(token, expiresAt());
        return new DownloadUrlResponse(downloadUrl(cardId, "image", token));
    }

    // ── 실제 다운로드 (토큰만으로 접근) ──────────────────────

    /**
     * 트랜잭션을 걸지 않는다 — 사진을 읽느라 버킷 GET(외부 I/O)이 일어나는데,
     * 그동안 DB 커넥션을 붙잡으면 커넥션 풀이 마른다(코드컨벤션 §1). 읽기 전용이라 필요도 없다.
     */
    public DownloadFile downloadVcf(String cardId, String token) {
        BusinessCardEntity card = businessCardFinder.active(cardId);
        if (!card.isVcfTokenValid(token)) {
            throw new BusinessRuleException("VCF 다운로드 토큰이 유효하지 않습니다.");
        }
        return buildVcf(card);
    }

    /**
     * 토큰 검증 없이 vCard 파일만 만든다.
     *
     * <p>접근 통제는 <b>호출부 책임</b>이다 — 여기서는 토큰도 소유자도 보지 않는다.
     * 공개 링크 경로({@code PublicBusinessCardService})가 같은 파일을 만들어야 해서 떼어 뒀다.
     * 새로 호출할 때는 "이 카드를 보여줘도 되는가"를 먼저 판단한 뒤 부를 것.
     */
    public DownloadFile buildVcf(BusinessCardEntity card) {
        VCardPhotoLoader.VCardPhoto photo = vCardPhotoLoader.load(card.getBusinessCardImagePath());
        byte[] content = vCardGeneratorUtil
                .generateVCard(card, photo.type(), photo.base64())
                .getBytes(StandardCharsets.UTF_8);
        return new DownloadFile(
                fileNameFor(card.getFullName(), "vcf"),
                "text/vcard; charset=UTF-8",
                content);
    }

    /** 위와 같은 이유로 트랜잭션 없음. */
    public DownloadFile downloadImage(String cardId, String token) {
        BusinessCardEntity card = businessCardFinder.active(cardId);
        if (!card.isImageTokenValid(token)) {
            throw new BusinessRuleException("이미지 다운로드 토큰이 유효하지 않습니다.");
        }
        if (!hasImage(card)) {
            throw new BusinessRuleException("명함 이미지가 존재하지 않습니다.");
        }

        String imagePath = card.getBusinessCardImagePath();
        StoredFile stored = fileStorage.load(imagePath)
                .orElseThrow(() -> new EntityNotFoundException("명함 이미지를 찾을 수 없습니다."));

        String contentType = stored.contentType() == null || stored.contentType().isBlank()
                ? "application/octet-stream"
                : stored.contentType();
        return new DownloadFile(
                fileNameFor(card.getFullName(), cardImageStorage.extensionOf(imagePath)),
                contentType,
                stored.bytes());
    }

    // ── 내부 ──────────────────────────────────────────────

    private boolean hasImage(BusinessCardEntity card) {
        String path = card.getBusinessCardImagePath();
        return path != null && !path.isBlank();
    }

    private String newToken() {
        return UUID.randomUUID().toString();
    }

    private LocalDateTime expiresAt() {
        return LocalDateTime.now().plusMinutes(TOKEN_TTL_MINUTES);
    }

    private String downloadUrl(String cardId, String kind, String token) {
        return publicUrlResolver.baseUriBuilder()
                .path("/api/business-cards/")
                .path(cardId)
                .path("/downloads/")
                .path(kind)
                .queryParam("token", token)
                .toUriString();
    }

    /** 저장될 파일 이름. 이름에 경로·따옴표가 섞이지 않도록 한글·영숫자만 남긴다. */
    private String fileNameFor(String fullName, String extension) {
        String safeName = fullName == null
                ? "business_card"
                : fullName.replaceAll("[^a-zA-Z0-9가-힣]", "_");
        String normalized = extension.startsWith(".") ? extension.substring(1) : extension;
        return safeName + "_business_card." + normalized;
    }
}
