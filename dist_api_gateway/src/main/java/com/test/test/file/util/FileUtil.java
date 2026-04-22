package com.test.test.file.util;

import com.test.test.file.strategy.FileStorageStrategy;
import com.test.test.file.strategy.FileStorageStrategy.FileUploadResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 파일 유틸리티
 * - FileStorageStrategy를 통해 파일 저장 (로컬 또는 Supabase)
 * - 환경에 따라 스프링이 적절한 전략 구현체를 자동 주입
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class FileUtil {

    // 스프링이 환경에 맞는 구현체 자동 주입
    // - supabase.enabled=false → LocalFileStorage
    // - supabase.enabled=true  → SupabaseFileStorage
    private final FileStorageStrategy fileStorageStrategy;

    /**
     * 파일 저장
     * @param file 업로드할 파일
     * @return 저장 결과 (경로, 파일명 등)
     */
    public FileUploadResult saveFile(MultipartFile file) {
        return fileStorageStrategy.uploadFile(file);
    }

    /**
     * 파일 삭제
     * @param filePath 삭제할 파일 경로
     */
    public void deleteFile(String filePath) {
        fileStorageStrategy.deleteFile(filePath);
    }
}
