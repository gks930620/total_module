package com.doll.gacha.file.util;

import com.doll.gacha.file.strategy.FileStorageStrategy;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * 파일 유틸리티
 * - FileStorageStrategy(DbFileStorage)를 통해 파일 바이트를 DB에 저장/삭제
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class FileUtil {

    private final FileStorageStrategy fileStorageStrategy; // 유일 구현: DbFileStorage

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
