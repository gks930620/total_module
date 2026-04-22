package com.businesscard.card.service;

public record DownloadFile(
        String fileName,
        String contentType,
        byte[] bytes
) {
}
