package com.doll.gacha.file.controller;

import com.doll.gacha.common.dto.ApiResponse;
import com.doll.gacha.file.dto.FileDetailDTO;
import com.doll.gacha.file.entity.FileEntity;
import com.doll.gacha.file.service.FileService;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import com.doll.gacha.file.util.FileUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Slf4j
public class FileController {
    private final FileService fileService;
    private final FileUtil fileUtil;

    @Value("${file.upload-dir:./uploads/}")
    private String uploadDir;

    /**
     * 이미지 파일 서빙 (HTML img 태그에서 호출)
     * - 로컬 저장 모드에서만 사용
     * - Supabase 모드에서는 CDN URL로 직접 접근하므로 이 API 사용 안 함
     */
    @GetMapping("/images/{filename:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) {
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path file = uploadPath.resolve(filename).normalize();

            // 경로 순회 방어: 정규화 후에도 업로드 디렉토리 내부여야 함
            if (!file.startsWith(uploadPath)) {
                log.warn("잘못된 파일 경로 접근 시도: {}", filename);
                return ResponseEntity.badRequest().build();
            }

            Resource resource = new UrlResource(file.toUri());

            if (resource.exists() && resource.isReadable()) {
                String contentType = "image/jpeg"; // 기본값
                if (filename.toLowerCase().endsWith(".png")) contentType = "image/png";
                else if (filename.toLowerCase().endsWith(".gif")) contentType = "image/gif";

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
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

        // 1. FileUtil로 물리적 파일 저장
        List<FileUploadResult> uploadResults = files.stream()
                .filter(file -> !file.isEmpty())
                .map(fileUtil::saveFile)
                .toList();

        log.info("파일 물리적 저장 완료 - 파일 수: {}", uploadResults.size());

        // 2. FileService로 DB에 파일 정보 저장
        List<String> savedPaths = fileService.saveFiles(uploadResults, refId, refType, usage);

        log.info("파일 업로드 완료 - refId: {}, refType: {}, 파일 수: {}", refId, refType, savedPaths.size());

        // 실패 시(파라미터 오류/저장 실패)는 GlobalExceptionHandler 가 표준 ErrorResponse 로 처리
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("파일 업로드 성공", savedPaths));
    }

    /**
     * 첨부파일 상세 정보 조회 API (원본 파일명 포함)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT (선택)
     * @return 파일 상세 정보 리스트
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
     * 첨부파일 다운로드 API
     * - 로컬 파일: 직접 서빙
     * - Supabase 파일: CDN에서 가져와서 원본 파일명으로 응답
     * @param fileId 파일 ID
     * @return 파일 리소스 (원본 파일명으로 다운로드)
     */
    @GetMapping("/api/files/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        try {
            // 1. DB에서 파일 정보 조회
            FileEntity fileEntity = fileService.getFileById(fileId);
            if (fileEntity == null) {
                log.warn("파일을 찾을 수 없습니다: fileId={}", fileId);
                return ResponseEntity.notFound().build();
            }

            String filePath = fileEntity.getFilePath();
            Resource resource;

            // 2. CDN URL인지 로컬 파일인지 판단
            if (filePath != null && filePath.startsWith("http")) {
                // Supabase CDN URL → URL Resource로 로드
                log.info("CDN 파일 다운로드: fileId={}, url={}", fileId, filePath);
                resource = new UrlResource(filePath);
            } else {
                // 로컬 파일 → 기존 방식
                Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
                Path file = uploadPath.resolve(fileEntity.getStoredFileName());
                log.info("로컬 파일 다운로드: fileId={}, path={}", fileId, file);
                resource = new UrlResource(file.toUri());
            }

            if (!resource.exists() || !resource.isReadable()) {
                log.error("파일을 찾을 수 없습니다: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            // 3. 원본 파일명 인코딩 (한글 파일명 지원)
            String encodedFileName = URLEncoder.encode(fileEntity.getOriginalFileName(), StandardCharsets.UTF_8)
                    .replaceAll("\\+", "%20");

            // 4. 다운로드 응답 헤더 설정 (원본 파일명으로!)
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            log.error("파일 경로 오류: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("파일 다운로드 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 파일 삭제 API
     * @param fileId 삭제할 파일 ID
     * @return 성공 시 삭제 완료 메시지
     */
    @DeleteMapping("/api/files/{fileId}")
    public ResponseEntity<ApiResponse<Void>> deleteFile(@PathVariable Long fileId) {
        log.info("파일 삭제 요청: fileId={}", fileId);
        // 미존재 파일은 FileService 가 IllegalArgumentException("...찾을 수 없습니다") 을 던지고
        // GlobalExceptionHandler 가 표준 404 ErrorResponse 로 처리
        fileService.deleteFile(fileId);
        return ResponseEntity.ok(ApiResponse.success("파일이 삭제되었습니다"));
    }
}
