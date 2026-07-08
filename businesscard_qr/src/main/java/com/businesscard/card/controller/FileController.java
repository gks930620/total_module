package com.businesscard.card.controller;

import com.businesscard.card.storage.FileStorage;
import com.businesscard.card.storage.StoredFile;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 업로드된 파일 인라인 서빙.
 *
 * <p>정적 리소스 핸들러 대신 컨트롤러로 서빙하여 저장 백엔드(DB/로컬)를 통일한다.
 * 이렇게 하면 저장 백엔드가 무엇이든 명함 이미지 인라인 표시(`imageUrl`)가 동일하게 동작한다.
 */
@RestController
@RequiredArgsConstructor
public class FileController {

    private final FileStorage fileStorage;

    @GetMapping("/uploads/**")
    public ResponseEntity<byte[]> serve(HttpServletRequest request) {
        String logicalPath = request.getRequestURI();
        return fileStorage.load(logicalPath)
                .map(this::toResponse)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private ResponseEntity<byte[]> toResponse(StoredFile file) {
        MediaType mediaType = file.contentType() == null || file.contentType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(file.contentType());
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(file.bytes());
    }
}
