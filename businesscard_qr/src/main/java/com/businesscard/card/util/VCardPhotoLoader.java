package com.businesscard.card.util;

import com.businesscard.card.storage.FileStorage;
import com.businesscard.card.storage.StoredFile;
import com.businesscard.card.support.CardImageStorage;
import java.util.Base64;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * vCard 에 넣을 사진을 읽어 base64 로 만든다.
 *
 * <p>{@link VCardGeneratorUtil} 은 <b>문자열을 만드는 일</b>만 하고,
 * 저장소에서 바이트를 읽어 오는 일은 여기서 한다.
 */
@Component
@RequiredArgsConstructor
public class VCardPhotoLoader {

    private final FileStorage fileStorage;
    private final CardImageStorage cardImageStorage;

    /**
     * 사진이 없거나 읽기에 실패하면 <b>빈 사진</b>을 돌려준다.
     * vCard 는 사진 없이도 유효해야 하므로, 사진 하나 때문에 연락처 저장 전체를 실패시키지 않는다.
     */
    public VCardPhoto load(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            return VCardPhoto.empty();
        }

        Optional<StoredFile> stored;
        try {
            stored = fileStorage.load(imagePath);
        } catch (RuntimeException ignored) {
            return VCardPhoto.empty();
        }
        if (stored.isEmpty() || stored.get().bytes().length == 0) {
            return VCardPhoto.empty();
        }

        String photoType = toPhotoType(cardImageStorage.extensionOf(imagePath));
        String encoded = Base64.getEncoder().encodeToString(stored.get().bytes());
        return new VCardPhoto(photoType, encoded);
    }

    /** vCard 의 {@code TYPE=} 값. 규격이 대문자 약어를 쓴다. */
    private String toPhotoType(String extension) {
        return switch (extension.toLowerCase()) {
            case "jpg", "jpeg" -> "JPEG";
            case "png" -> "PNG";
            case "gif" -> "GIF";
            case "bmp" -> "BMP";
            case "webp" -> "WEBP";
            default -> "JPEG";
        };
    }

    /** 사진 없음은 두 값이 모두 null 인 상태로 표현한다. */
    public record VCardPhoto(String type, String base64) {
        public static VCardPhoto empty() {
            return new VCardPhoto(null, null);
        }
    }
}
