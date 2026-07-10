package com.doll.gacha.file.strategy;

import org.springframework.web.multipart.MultipartFile;

/**
 * 파일 저장 전략 인터페이스
 * - 구현체: DbFileStorage (DB LONGBLOB) — 로컬(H2)·운영(MySQL) 공통 유일 구현
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
     * @param filePath 삭제할 파일 경로 (/uploads/저장파일명)
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
        private String filePath;          // 웹 경로 (/uploads/저장파일명 — FileController가 DB에서 서빙)
        private Long fileSize;            // 파일 크기
        private String contentType;       // MIME 타입

        /** 웹에서 사용할 경로 (/uploads/저장파일명) */
        public String getWebPath() {
            return "/uploads/" + storedFilename;
        }
    }
}

