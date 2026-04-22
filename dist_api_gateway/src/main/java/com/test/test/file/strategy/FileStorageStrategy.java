package com.test.test.file.strategy;

import org.springframework.web.multipart.MultipartFile;

/**
 * 파일 저장 전략 인터페이스
 * - 구현체: LocalFileStorage (로컬), SupabaseFileStorage (Supabase)
 * - 환경에 따라 스프링이 자동으로 적절한 구현체 주입
 */
public interface FileStorageStrategy {

    /**
     * 파일 업로드
     * @param file 업로드할 파일
     * @return 저장 결과 (경로, 파일명 등)
     */
    FileUploadResult uploadFile(MultipartFile file);

    /**
     * 파일 삭제
     * @param filePath 삭제할 파일 경로 (로컬 경로 또는 CDN URL)
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
        private String filePath;          // 물리적 경로 (로컬) 또는 CDN URL (Supabase)
        private Long fileSize;            // 파일 크기
        private String contentType;       // MIME 타입

        /**
         * 웹에서 사용할 경로 반환
         * - Supabase: CDN URL 그대로 (https://xxx.supabase.co/...)
         * - 로컬: /uploads/파일명
         */
        public String getWebPath() {
            // CDN URL인 경우 그대로 반환
            if (filePath != null && filePath.startsWith("http")) {
                return filePath;
            }
            return "/uploads/" + storedFilename;
        }
    }
}

