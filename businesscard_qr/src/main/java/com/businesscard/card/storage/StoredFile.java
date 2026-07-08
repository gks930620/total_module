package com.businesscard.card.storage;

/**
 * 스토리지에서 읽어온 파일의 원본 바이트와 콘텐츠 타입.
 */
public record StoredFile(byte[] bytes, String contentType) {
}
