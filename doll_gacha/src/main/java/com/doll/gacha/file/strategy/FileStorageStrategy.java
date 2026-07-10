package com.doll.gacha.file.strategy;

import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;

/**
 * 파일 저장 전략 인터페이스.
 * - 구현체: BucketFileStorage (Railway Storage Bucket / S3 호환), LocalDiskFileStorage (로컬 디스크 폴백)
 * - 선택: app.bucket.endpoint(BUCKET_ENDPOINT)가 비어있지 않으면 S3, 아니면 디스크 (FileStorageConfig 참고)
 */
public interface FileStorageStrategy {

    /**
     * 파일 업로드
     * @param file 업로드할 파일
     * @return 저장 결과 (경로, 파일명 등)
     */
    FileUploadResult uploadFile(MultipartFile file);

    /**
     * 저장 파일명으로 파일 바이트+컨텐츠 타입을 읽는다 (서빙/다운로드용).
     * @param storedFileName 저장 파일명 (UUID.ext)
     * @return 파일이 있으면 LoadedFile, 없으면 empty
     */
    Optional<LoadedFile> load(String storedFileName);

    /**
     * 파일 삭제
     * @param filePath 삭제할 파일 경로 (/uploads/저장파일명 또는 저장파일명)
     */
    void deleteFile(String filePath);

    /**
     * 파일 저장 결과 DTO
     */
    @lombok.Getter
    @lombok.Builder
    class FileUploadResult {
        private String originalFilename;  // 원본 파일명
        private String storedFilename;    // 저장된 파일명 (UUID)
        private String filePath;          // 웹 경로 (/uploads/저장파일명 — FileController가 스토리지에서 서빙)
        private Long fileSize;            // 파일 크기
        private String contentType;       // MIME 타입

        /** 웹에서 사용할 경로 (/uploads/저장파일명) */
        public String getWebPath() {
            return "/uploads/" + storedFilename;
        }
    }

    /**
     * 읽어온 파일 바이트 + 컨텐츠 타입 보관용 내부 홀더.
     */
    @lombok.Getter
    @lombok.RequiredArgsConstructor
    class LoadedFile {
        private final byte[] data;
        private final String contentType;
    }
}
