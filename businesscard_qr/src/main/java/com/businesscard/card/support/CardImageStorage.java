package com.businesscard.card.support;

import com.businesscard.card.storage.FileStorage;
import com.businesscard.common.exception.BusinessRuleException;
import java.io.IOException;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 명함 이미지의 <b>업로드 쪽</b> 규칙 — 형식 검증·파일명 결정·저장·삭제.
 *
 * <p>범용 {@link FileStorage}(어떤 바이트든 받는다) 위에 명함 도메인의 규칙을 얹은 층이다.
 * 이걸 서비스 안에 두면 CRUD 로직 사이에 확장자·MIME 처리가 섞여 읽기 어려워진다.
 */
@Component
@RequiredArgsConstructor
public class CardImageStorage {

    private static final String KEY_PREFIX = "business-card-images/";
    private static final String FALLBACK_EXTENSION = "jpg";
    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp");

    private final FileStorage fileStorage;

    /**
     * 이미지를 저장하고 논리 경로를 돌려준다. 이미지가 없으면 {@code null}.
     *
     * <p>파일명은 {@code <cardId>_<timestamp>.<ext>} 다. cardId 가 UUID 라서
     * {@code /uploads/**} 가 공개 경로여도 <b>남이 경로를 추측할 수 없다</b>
     * (그래서 {@code resolveCardId} 가 UUID 형식을 강제한다).
     */
    public String store(String cardId, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            return null;
        }

        String extension = extensionOf(image.getOriginalFilename());
        validate(image, extension);

        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException e) {
            throw new BusinessRuleException("이미지 파일 저장에 실패했습니다.");
        }

        String fileName = cardId + "_" + System.currentTimeMillis() + "." + extension;
        return fileStorage.store(KEY_PREFIX + fileName, bytes, image.getContentType());
    }

    public void deleteIfExists(String logicalPath) {
        if (logicalPath == null || logicalPath.isBlank()) {
            return;
        }
        fileStorage.delete(logicalPath);
    }

    /**
     * 경로·파일명에서 확장자를 뽑는다. 알 수 없으면 {@code jpg} 로 둔다
     * (다운로드 파일명에 쓰이는 값이라 비어 있으면 곤란하다).
     *
     * <p>다운로드 쪽에서도 같은 규칙이 필요해 공개해 둔다.
     */
    public String extensionOf(String pathOrFileName) {
        if (pathOrFileName == null) {
            return FALLBACK_EXTENSION;
        }
        String fileName = fileNameOf(pathOrFileName);
        if (!fileName.contains(".")) {
            return FALLBACK_EXTENSION;
        }
        String extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        // 확장자가 그대로 저장 파일명이 되므로 형태를 좁게 제한한다.
        return extension.matches("[a-z0-9]{1,10}") ? extension : FALLBACK_EXTENSION;
    }

    private String fileNameOf(String logicalPath) {
        int slash = logicalPath.lastIndexOf('/');
        return slash >= 0 ? logicalPath.substring(slash + 1) : logicalPath;
    }

    /** Content-Type 과 확장자를 <b>둘 다</b> 본다 — 한쪽만 보면 위장 업로드를 놓친다. */
    private void validate(MultipartFile image, String extension) {
        String contentType = image.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
            throw new BusinessRuleException("이미지 파일만 업로드할 수 있습니다.");
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessRuleException(
                    "지원하지 않는 이미지 확장자입니다. (jpg/jpeg/png/gif/bmp/webp)");
        }
    }
}
