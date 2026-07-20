package com.businesscard.card.controller;

import com.businesscard.card.dto.BusinessCardIdResponse;
import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.service.BusinessCardService;
import com.businesscard.card.service.DownloadFile;
import com.businesscard.common.dto.ApiResponse;
import com.businesscard.common.dto.PageResponse;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/business-cards")
@RequiredArgsConstructor
public class BusinessCardController {

    private final BusinessCardService businessCardService;

    /** 명함 목록 페이징 조회 (최신 등록순). 앱 무한스크롤용 — content/last 를 보고 다음 페이지를 이어 요청한다. */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<BusinessCardResponse>>> getBusinessCards(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageResponse<BusinessCardResponse> data =
                businessCardService.getBusinessCards(authentication.getName(), page, size);
        return ResponseEntity.ok(ApiResponse.success("Business card list loaded", data));
    }

    @GetMapping("/{cardId}")
    public ResponseEntity<ApiResponse<BusinessCardResponse>> getBusinessCard(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        BusinessCardResponse data = businessCardService.getBusinessCard(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("Business card loaded", data));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BusinessCardIdResponse>> createBusinessCard(
            Authentication authentication,
            @RequestPart("payload") String payload,
            @RequestPart(value = "businessCardImage", required = false) MultipartFile businessCardImage
    ) {
        BusinessCardIdResponse data = businessCardService.createBusinessCard(authentication.getName(), payload, businessCardImage);
        return ResponseEntity.ok(ApiResponse.success("Business card created", data));
    }

    @PutMapping(value = "/{cardId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BusinessCardIdResponse>> updateBusinessCard(
            Authentication authentication,
            @PathVariable String cardId,
            @RequestPart("payload") String payload,
            @RequestPart(value = "businessCardImage", required = false) MultipartFile businessCardImage
    ) {
        BusinessCardIdResponse data = businessCardService.updateBusinessCard(authentication.getName(), cardId, payload, businessCardImage);
        return ResponseEntity.ok(ApiResponse.success("Business card updated", data));
    }

    @DeleteMapping("/{cardId}")
    public ResponseEntity<ApiResponse<Void>> deleteBusinessCard(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        businessCardService.deleteBusinessCard(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("Business card deleted", null));
    }

    // 조회수 증가는 공개 엔드포인트다. 명함을 QR로 스캔한 비로그인 방문자가
    // 조회수를 올릴 수 있어야 하므로 인증(Authentication)을 요구하지 않는다.
    @PostMapping("/{cardId}/view-count")
    public ResponseEntity<ApiResponse<Void>> incrementViewCount(
            @PathVariable String cardId
    ) {
        businessCardService.incrementViewCount(cardId);
        return ResponseEntity.ok(ApiResponse.success("View count increased", null));
    }

    @GetMapping("/{cardId}/vcf-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getVcfDownloadUrl(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = businessCardService.generateVcfDownloadUrl(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("VCF download URL issued", data));
    }

    @GetMapping("/{cardId}/image-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getImageDownloadUrl(
            Authentication authentication,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = businessCardService.generateImageDownloadUrl(authentication.getName(), cardId);
        return ResponseEntity.ok(ApiResponse.success("Image download URL issued", data));
    }

    @GetMapping("/{cardId}/downloads/vcf")
    public ResponseEntity<byte[]> downloadVcf(
            @PathVariable String cardId,
            @RequestParam("token") String token
    ) {
        DownloadFile file = businessCardService.downloadVcf(cardId, token);
        return downloadResponse(file);
    }

    @GetMapping("/{cardId}/downloads/image")
    public ResponseEntity<byte[]> downloadImage(
            @PathVariable String cardId,
            @RequestParam("token") String token
    ) {
        DownloadFile file = businessCardService.downloadImage(cardId, token);
        return downloadResponse(file);
    }

    private ResponseEntity<byte[]> downloadResponse(DownloadFile file) {
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }
}
