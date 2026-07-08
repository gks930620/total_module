package com.doll.gacha.file.service;

import com.doll.gacha.file.dto.FileDetailDTO;
import com.doll.gacha.file.entity.FileEntity;
import com.doll.gacha.file.repository.FileRepository;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Slf4j
public class FileService {

    private final FileRepository fileRepository;

    /**
     * 파일 경로 조회 (통합 검색 - QueryDSL 동적 쿼리)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
    /**
     * 파일 경로 조회 (통합 검색 - QueryDSL 동적 쿼리)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT (선택, null 가능)
     * @return 파일 웹 경로 리스트 (Supabase: CDN URL, 로컬: /uploads/xxx)
     */
    public List<String> getFilePaths(Long refId, String refType, String usage) {
        FileEntity.RefType type = FileEntity.RefType.valueOf(refType);
        FileEntity.Usage usageType = usage != null && !usage.isEmpty()
                ? FileEntity.Usage.valueOf(usage)
                : null;

        // QueryDSL 동적 쿼리 실행
        List<FileEntity> files = fileRepository.searchFiles(refId, type, usageType);

        // DB에 저장된 filePath 그대로 반환 (CDN URL 또는 /uploads/xxx)
        return files.stream()
                .map(FileEntity::getFilePath)
                .toList();
    }

    /**
     * 파일 정보 DB 저장 (물리적 저장은 FileUtil에서 처리)
     * @param uploadResults FileUtil에서 저장한 파일 결과 리스트
     * @param refId 참조 ID
     * @param refType 참조 타입
     * @param usage 파일 용도
     * @return 저장된 파일 웹 경로 리스트 (Supabase: CDN URL, 로컬: /uploads/xxx)
     */
    @Transactional
    public List<String> saveFiles(List<FileUploadResult> uploadResults, Long refId,
                                   FileEntity.RefType refType, FileEntity.Usage usage) {
        return uploadResults.stream()
                .map(result -> {
                    FileEntity fileEntity = FileEntity.builder()
                            .originalFileName(result.getOriginalFilename())
                            .storedFileName(result.getStoredFilename())
                            .filePath(result.getWebPath())  // 웹 경로 저장 (CDN URL 또는 /uploads/xxx)
                            .fileSize(result.getFileSize())
                            .contentType(result.getContentType())
                            .refId(refId)
                            .refType(refType)
                            .fileUsage(usage)
                            .build();

                    fileRepository.save(fileEntity);

                    log.info("파일 정보 DB 저장 완료 - refId: {}, refType: {}, 파일명: {}, 경로: {}",
                            refId, refType, result.getStoredFilename(), result.getWebPath());

                    return result.getWebPath();  // CDN URL 또는 /uploads/xxx 반환
                })
                .toList();
    }

    /**
     * 파일 ID로 파일 정보 조회 (다운로드용)
     * @param fileId 파일 ID
     * @return 파일 엔티티
     */
    public FileEntity getFileById(Long fileId) {
        return fileRepository.findById(fileId).orElse(null);
    }

    /**
     * 파일 삭제 (DB에서만 삭제, 물리 파일은 배치로 처리)
     * @param fileId 삭제할 파일 ID
     */
    @Transactional
    public void deleteFile(Long fileId) {
        FileEntity fileEntity = fileRepository.findById(fileId)
                .orElseThrow(() -> new IllegalArgumentException("파일을 찾을 수 없습니다: " + fileId));

        fileRepository.delete(fileEntity);
        log.info("파일 삭제 완료 - fileId: {}, 파일명: {}", fileId, fileEntity.getOriginalFileName());
    }

    /**
     * 파일 상세 정보 조회 (원본 파일명 포함)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT (선택, null 가능)
     * @return 파일 상세 정보 리스트
     */
    public List<FileDetailDTO> getFileDetails(Long refId, String refType, String usage) {
        FileEntity.RefType type = FileEntity.RefType.valueOf(refType);
        FileEntity.Usage usageType = usage != null && !usage.isEmpty()
                ? FileEntity.Usage.valueOf(usage)
                : null;

        List<FileEntity> files = fileRepository.searchFiles(refId, type, usageType);

        return files.stream()
                .map(FileDetailDTO::from)
                .toList();
    }
}
