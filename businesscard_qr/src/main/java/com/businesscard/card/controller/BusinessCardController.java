package com.businesscard.card.controller;

import com.businesscard.card.dto.BusinessCardIdResponse;
import com.businesscard.card.dto.BusinessCardResponse;
import com.businesscard.card.dto.DownloadUrlResponse;
import com.businesscard.card.service.BusinessCardService;
import com.businesscard.card.service.DownloadFile;
import com.businesscard.common.dto.ApiResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
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

    @GetMapping
    public ResponseEntity<ApiResponse<List<BusinessCardResponse>>> getBusinessCards(
            @RequestHeader("X-User-Id") String userId
    ) {
        List<BusinessCardResponse> data = businessCardService.getBusinessCards(userId);
        return ResponseEntity.ok(ApiResponse.success("명함 목록 조회 성공", data));
    }

    @GetMapping("/{cardId}")
    public ResponseEntity<ApiResponse<BusinessCardResponse>> getBusinessCard(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId
    ) {
        BusinessCardResponse data = businessCardService.getBusinessCard(userId, cardId);
        return ResponseEntity.ok(ApiResponse.success("명함 조회 성공", data));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BusinessCardIdResponse>> createBusinessCard(
            @RequestHeader("X-User-Id") String userId,
            @RequestPart("payload") String payload,
            @RequestPart(value = "businessCardImage", required = false) MultipartFile businessCardImage
    ) {
        BusinessCardIdResponse data = businessCardService.createBusinessCard(userId, payload, businessCardImage);
        return ResponseEntity.ok(ApiResponse.success("명함 생성 성공", data));
    }

    @PutMapping(value = "/{cardId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<BusinessCardIdResponse>> updateBusinessCard(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId,
            @RequestPart("payload") String payload,
            @RequestPart(value = "businessCardImage", required = false) MultipartFile businessCardImage
    ) {
        BusinessCardIdResponse data = businessCardService.updateBusinessCard(userId, cardId, payload, businessCardImage);
        return ResponseEntity.ok(ApiResponse.success("명함 수정 성공", data));
    }

    @DeleteMapping("/{cardId}")
    public ResponseEntity<ApiResponse<Void>> deleteBusinessCard(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId
    ) {
        businessCardService.deleteBusinessCard(userId, cardId);
        return ResponseEntity.ok(ApiResponse.success("명함 삭제 성공", null));
    }

    @PostMapping("/{cardId}/view-count")
    public ResponseEntity<ApiResponse<Void>> incrementViewCount(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId
    ) {
        businessCardService.incrementViewCount(userId, cardId);
        return ResponseEntity.ok(ApiResponse.success("조회수 증가 성공", null));
    }

    @GetMapping("/{cardId}/vcf-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getVcfDownloadUrl(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = businessCardService.generateVcfDownloadUrl(userId, cardId);
        return ResponseEntity.ok(ApiResponse.success("VCF 다운로드 URL 발급 성공", data));
    }

    @GetMapping("/{cardId}/image-download-url")
    public ResponseEntity<ApiResponse<DownloadUrlResponse>> getImageDownloadUrl(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String cardId
    ) {
        DownloadUrlResponse data = businessCardService.generateImageDownloadUrl(userId, cardId);
        return ResponseEntity.ok(ApiResponse.success("이미지 다운로드 URL 발급 성공", data));
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
