package com.doll.gacha.file.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.file.dto.FileDetailDTO;
import com.doll.gacha.file.entity.FileEntity;
import com.doll.gacha.file.service.FileService;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import com.doll.gacha.file.strategy.FileStorageStrategy.LoadedFile;
import com.doll.gacha.file.util.FileUtil;
import com.doll.gacha.jwt.model.CustomUserAccount;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Slf4j
public class FileController {
    private final FileService fileService;
    private final FileUtil fileUtil;

    /**
     * 업로드 이미지 인라인 서빙 (HTML img 태그에서 호출).
     * 저장 전략(버킷 S3 / 로컬 디스크)에서 바이트를 읽어 스트리밍한다.
     * (경로 계약: DollShop/파일 메타의 imagePath = /uploads/{storedFileName})
     */
    @GetMapping("/uploads/{storedFileName:.+}")
    public ResponseEntity<byte[]> serveUpload(@PathVariable String storedFileName) {
        return fileUtil.load(storedFileName)
                .map(this::toInlineResponse)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private ResponseEntity<byte[]> toInlineResponse(LoadedFile file) {
        MediaType mediaType = (file.getContentType() == null || file.getContentType().isBlank())
                ? MediaType.APPLICATION_OCTET_STREAM
                : MediaType.parseMediaType(file.getContentType());
        return ResponseEntity.ok().contentType(mediaType).body(file.getData());
    }

    /**
     * 파일 검색 API (통합)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT (선택)
     * @return 파일 경로 리스트
     */
    @GetMapping("/api/files")
    public ResponseEntity<ApiResponse<List<String>>> getFiles(
            @RequestParam Long refId,
            @RequestParam String refType,
            @RequestParam(required = false) String usage) {

        // 잘못된 파라미터(refType 등)는 GlobalExceptionHandler 가 표준 ErrorResponse 로 처리
        List<String> filePaths = fileService.getFilePaths(refId, refType, usage);
        return ResponseEntity.ok(ApiResponse.success("파일 목록 조회 성공", filePaths));
    }

    /**
     * 파일 업로드 API (공통)
     * @param files 업로드할 파일들
     * @param refId 참조 ID (리뷰 ID, 가게 ID 등)
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT
     * @return 업로드된 파일 경로 리스트
     */
    @PostMapping("/api/files/upload")
    public ResponseEntity<ApiResponse<List<String>>> uploadFiles(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam Long refId,
            @RequestParam FileEntity.RefType refType,
            @RequestParam FileEntity.Usage usage) {

        // 1. FileUtil로 파일 바이트를 스토리지(버킷/디스크)에 저장
        List<FileUploadResult> uploadResults = files.stream()
                .filter(file -> !file.isEmpty())
                .map(fileUtil::saveFile)
                .toList();

        log.info("파일 저장 완료 - 파일 수: {}", uploadResults.size());

        // 2. FileService로 파일 메타 정보(files 테이블) 저장
        List<String> savedPaths = fileService.saveFiles(uploadResults, refId, refType, usage);

        log.info("파일 업로드 완료 - refId: {}, refType: {}, 파일 수: {}", refId, refType, savedPaths.size());

        // 실패 시(파라미터 오류/저장 실패)는 GlobalExceptionHandler 가 표준 ErrorResponse 로 처리
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("파일 업로드 성공", savedPaths));
    }

    /**
     * 첨부파일 상세 정보 조회 API (원본 파일명 포함)
     */
    @GetMapping("/api/files/detail")
    public ResponseEntity<ApiResponse<List<FileDetailDTO>>> getFileDetails(
            @RequestParam Long refId,
            @RequestParam String refType,
            @RequestParam(required = false) String usage) {
        // 잘못된 파라미터(refType 등)는 GlobalExceptionHandler 가 표준 ErrorResponse 로 처리
        List<FileDetailDTO> fileDetails = fileService.getFileDetails(refId, refType, usage);
        return ResponseEntity.ok(ApiResponse.success("파일 조회 성공", fileDetails));
    }

    /**
     * 첨부파일 다운로드 API (원본 파일명으로 저장되게 응답).
     * 저장 전략(버킷 S3 / 로컬 디스크)에서 바이트를 읽어 attachment 로 내려준다.
     * @param fileId 파일 메타 ID
     */
    @GetMapping("/api/files/download/{fileId}")
    public ResponseEntity<byte[]> downloadFile(@PathVariable Long fileId) {
        // 1. 파일 메타 조회 (없으면 EntityNotFoundException → GlobalExceptionHandler 404)
        FileEntity fileEntity = fileService.getFileById(fileId);

        // 2. 저장 파일명으로 스토리지 바이트 조회 (없으면 404)
        LoadedFile loaded = fileUtil.load(fileEntity.getStoredFileName()).orElse(null);
        if (loaded == null) {
            return ResponseEntity.notFound().build();
        }

        // 3. 원본 파일명 인코딩 (한글 파일명 지원)
        String encodedFileName = URLEncoder.encode(fileEntity.getOriginalFileName(), StandardCharsets.UTF_8)
                .replaceAll("\\+", "%20");

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"")
                .body(loaded.getData());
    }

    /**
     * 파일 삭제 API
     * @param fileId 삭제할 파일 ID
     */
    @DeleteMapping("/api/files/{fileId}")
    public ResponseEntity<ApiResponse<Void>> deleteFile(
            @PathVariable Long fileId,
            @AuthenticationPrincipal CustomUserAccount userAccount) {
        log.info("파일 삭제 요청: fileId={}, user={}", fileId, userAccount.getUsername());
        // 미존재 파일 → 404, 소유자 아님 → 403 (FileService 가 검증, GlobalExceptionHandler 가 표준 처리)
        fileService.deleteFile(fileId, userAccount.getUsername());
        return ResponseEntity.ok(ApiResponse.success("파일이 삭제되었습니다"));
    }
}
