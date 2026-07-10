package com.doll.gacha.file.util;

import com.doll.gacha.file.strategy.FileStorageStrategy;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import com.doll.gacha.file.strategy.FileStorageStrategy.LoadedFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;

/**
 * 파일 유틸리티
 * - FileStorageStrategy(버킷/디스크)를 통해 파일 바이트를 저장/조회/삭제
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class FileUtil {

    private final FileStorageStrategy fileStorageStrategy; // 버킷(S3) 또는 디스크 폴백

    /**
     * 파일 저장
     * @param file 업로드할 파일
     * @return 저장 결과 (경로, 파일명 등)
     */
    public FileUploadResult saveFile(MultipartFile file) {
        return fileStorageStrategy.uploadFile(file);
    }

    /**
     * 저장 파일명으로 파일 바이트+컨텐츠 타입 조회 (서빙/다운로드용)
     * @param storedFileName 저장 파일명
     * @return 파일이 있으면 LoadedFile, 없으면 empty
     */
    public Optional<LoadedFile> load(String storedFileName) {
        return fileStorageStrategy.load(storedFileName);
    }

    /**
     * 파일 삭제
     * @param filePath 삭제할 파일 경로
     */
    public void deleteFile(String filePath) {
        fileStorageStrategy.deleteFile(filePath);
    }
}
