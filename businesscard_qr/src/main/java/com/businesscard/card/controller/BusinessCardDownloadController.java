package com.businesscard.card.controller;

import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.service.BusinessCardDownloadService;
import com.businesscard.card.service.DownloadFile;
import com.businesscard.common.dto.ApiResponse;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 명함 파일 내려받기.
 *
 * <p>CRUD 컨트롤러와 나눠 둔 이유는 <b>접근 통제 방식이 다르기 때문</b>이다.
 * 토큰 발급은 인증된 소유자만 할 수 있지만, 실제 다운로드는 QR 을 스캔한
 * <b>비로그인 방문자</b>가 토큰만으로 접근한다(SecurityConfig 에서 열려 있다).
 */
@RestController
@RequestMapping("/api/business-cards")
@RequiredArgsConstructor
public class BusinessCardDownloadController {

    private final BusinessCardDownloadService downloadService;

    @GetMapping("/{cardId}/vcf-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getVcfDownloadUrl(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = downloadService.issueVcfDownloadUrl(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("VCF download URL issued", data));
    }

    @GetMapping("/{cardId}/image-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getImageDownloadUrl(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = downloadService.issueImageDownloadUrl(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("Image download URL issued", data));
    }

    /** 인증 없이 토큰만으로 접근한다 — QR 을 스캔한 방문자가 대상이다. */
    @GetMapping("/{cardId}/downloads/vcf")
    public ResponseEntity<byte[]> downloadVcf(
            @PathVariable String cardId,
            @RequestParam("token") String token
    ) {
        return toAttachment(downloadService.downloadVcf(cardId, token));
    }

    /** 위와 같다. */
    @GetMapping("/{cardId}/downloads/image")
    public ResponseEntity<byte[]> downloadImage(
            @PathVariable String cardId,
            @RequestParam("token") String token
    ) {
        return toAttachment(downloadService.downloadImage(cardId, token));
    }

    /** 파일명에 한글이 들어가므로 RFC 5987 방식으로 인코딩해 내려보낸다. */
    private ResponseEntity<byte[]> toAttachment(DownloadFile file) {
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }
}
