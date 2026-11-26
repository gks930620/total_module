package com.businesscard.card.controller;

import com.businesscard.card.dto.PublicBusinessCardResponse;
import com.businesscard.card.service.DownloadFile;
import com.businesscard.card.service.PublicBusinessCardService;
import com.businesscard.common.dto.ApiResponse;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공개 명함 보기 — <b>인증이 필요 없는</b> 엔드포인트만 모았다.
 * 설계: {@code 설계/웹앱_전환_설계.md} §4.
 *
 * <p>공개 API 를 한 클래스에 모아 두는 것 자체가 안전장치다 —
 * 소유자 전용 컨트롤러에 공개 메서드를 끼워 넣으면 리뷰에서 놓치기 쉽다.
 * 여기 들어오는 것은 "링크를 아는 누구나 볼 수 있다"는 뜻이고, 그 판단을 매번 의식하게 된다.
 */
@RestController
@RequestMapping("/api/business-cards/{cardId}/public")
@RequiredArgsConstructor
public class PublicBusinessCardController {

    private final PublicBusinessCardService publicBusinessCardService;

    /** 받는 사람이 보는 명함 데이터(축소형). */
    @GetMapping
    public ResponseEntity<ApiResponse<PublicBusinessCardResponse>> getPublicCard(@PathVariable String cardId) {
        PublicBusinessCardResponse data = publicBusinessCardService.getPublicCard(cardId);
        return ResponseEntity.ok(ApiResponse.success("Public business card loaded", data));
    }

    /** 연락처 저장용 vCard. 브라우저가 바로 다운로드하도록 attachment 로 내려준다. */
    @GetMapping("/vcf")
    public ResponseEntity<byte[]> downloadVcf(@PathVariable String cardId) {
        DownloadFile file = publicBusinessCardService.downloadVcf(cardId);
        ContentDisposition contentDisposition = ContentDisposition.attachment()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }
}
