package com.businesscard.card.util;

import com.businesscard.card.entity.BusinessCardEntity;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class VCardGeneratorUtil {

    public String generateVCard(BusinessCardEntity card) {
        return generateVCard(card, null, null);
    }

    public String generateVCard(BusinessCardEntity card, String photoType, String base64Photo) {
        List<String> lines = new ArrayList<>();
        lines.add("BEGIN:VCARD");
        lines.add("VERSION:3.0");
        lines.add("FN:" + safe(card.getFullName()));
        lines.add("N:" + safe(card.getFullName()) + ";;;;");

        if (hasText(card.getOrganization())) {
            lines.add("ORG:" + escape(card.getOrganization()));
        }
        if (hasText(card.getTitle())) {
            lines.add("TITLE:" + escape(card.getTitle()));
        }
        if (hasText(card.getPhone())) {
            lines.add("TEL;TYPE=CELL:" + escape(card.getPhone()));
        }
        if (hasText(card.getEmail())) {
            lines.add("EMAIL;TYPE=INTERNET:" + escape(card.getEmail()));
        }
        if (hasText(card.getWebsite())) {
            lines.add("URL:" + escape(card.getWebsite()));
        }
        if (hasText(card.getAddress())) {
            lines.add("ADR;TYPE=WORK:;;" + escape(card.getAddress()) + ";;;;");
        }
        if (hasText(card.getNote())) {
            lines.add("NOTE:" + escape(card.getNote()));
        }
        if (hasText(base64Photo)) {
            String normalizedPhotoType = hasText(photoType) ? photoType.toUpperCase() : "JPEG";
            lines.addAll(buildPhotoLines(normalizedPhotoType, base64Photo));
        }
        lines.add("END:VCARD");

        // vCard 규격(RFC 2426/6350)은 줄 끝을 CRLF(\r\n)로 강제한다.
        // LF만 쓰면 접힌 줄(PHOTO folding) 복원이 "CRLF+공백" 기준인 엄격한 파서
        // (삼성 연락처 등)에서 파싱이 깨져 "다운로드는 되는데 연락처 저장이 안 되는" 증상이 난다.
        return String.join("\r\n", lines) + "\r\n";
    }

    private List<String> buildPhotoLines(String photoType, String base64Photo) {
        final int maxLineLength = 75;
        List<String> lines = new ArrayList<>();
        String prefix = "PHOTO;ENCODING=b;TYPE=" + photoType + ":";

        int firstChunkSize = Math.max(1, maxLineLength - prefix.length());
        int firstEnd = Math.min(firstChunkSize, base64Photo.length());
        lines.add(prefix + base64Photo.substring(0, firstEnd));

        int index = firstEnd;
        int continuationChunkSize = maxLineLength - 1; // leading space for folded line
        while (index < base64Photo.length()) {
            int end = Math.min(index + continuationChunkSize, base64Photo.length());
            lines.add(" " + base64Photo.substring(index, end));
            index = end;
        }

        return lines;
    }

    private String safe(String value) {
        return hasText(value) ? escape(value) : "";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String escape(String value) {
        return value
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n");
    }
}
