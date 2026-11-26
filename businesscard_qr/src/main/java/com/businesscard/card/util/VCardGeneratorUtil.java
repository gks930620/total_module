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

    /**
     * vCard 값 이스케이프 (RFC 6350 §3.4).
     *
     * <p><b>줄바꿈 세 형태를 모두 지운다.</b> 이 파일은 줄을 CRLF 로 잇는데, 값 안에 살아남은
     * CR 하나만 있어도 파서가 거기서 줄을 끊고 뒤를 <b>새 속성</b>으로 읽는다.
     * 명함은 QR 로 남에게 공유되므로, 그렇게 되면 공격자가 자기 명함에
     * {@code \rTEL:010-...} 를 넣어 <b>스캔한 사람의 연락처에 화면에 없던 번호</b>를 심을 수 있다.
     *
     * <p>순서가 중요하다 — {@code \r\n} 을 먼저 처리하지 않으면 한 줄바꿈이 {@code \n\n} 두 개가 된다.
     * 역슬래시도 반드시 가장 먼저 치환해야 뒤에 넣는 이스케이프가 다시 이스케이프되지 않는다.
     */
    private String escape(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("\r\n", "\\n")
                .replace("\r", "\\n")
                .replace("\n", "\\n")
                .replace(";", "\\;")
                .replace(",", "\\,");
    }
}
