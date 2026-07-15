package com.doll.gacha.file.service;

import com.doll.gacha.common.exception.AccessDeniedException;
import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.community.repository.CommunityRepository;
import com.doll.gacha.file.dto.FileDetailDTO;
import com.doll.gacha.file.entity.FileEntity;
import com.doll.gacha.file.repository.FileRepository;
import com.doll.gacha.file.strategy.FileStorageStrategy.FileUploadResult;
import com.doll.gacha.file.util.FileUtil;
import com.doll.gacha.review.repository.ReviewRepository;
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
    private final FileUtil fileUtil;
    private final CommunityRepository communityRepository;
    private final ReviewRepository reviewRepository;

    /**
     * 파일 경로 조회 (통합 검색 - QueryDSL 동적 쿼리)
     * @param refId 참조 ID
     * @param refType DOLL_SHOP, COMMUNITY, REVIEW, DOLL
     * @param usage THUMBNAIL, IMAGES, ATTACHMENT (선택, null 가능)
     * @return 파일 웹 경로 리스트 (/uploads/저장파일명)
     */
    public List<String> getFilePaths(Long refId, String refType, String usage) {
        FileEntity.RefType type = FileEntity.RefType.valueOf(refType);
        FileEntity.Usage usageType = usage != null && !usage.isEmpty()
                ? FileEntity.Usage.valueOf(usage)
                : null;

        // QueryDSL 동적 쿼리 실행
        List<FileEntity> files = fileRepository.searchFiles(refId, type, usageType);

        // DB에 저장된 filePath(/uploads/저장파일명) 그대로 반환
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
     * @return 저장된 파일 웹 경로 리스트 (/uploads/저장파일명)
     */
    @Transactional
    public List<String> saveFiles(List<FileUploadResult> uploadResults, Long refId,
                                   FileEntity.RefType refType, FileEntity.Usage usage) {
        return uploadResults.stream()
                .map(result -> {
                    FileEntity fileEntity = FileEntity.builder()
                            .originalFileName(result.getOriginalFilename())
                            .storedFileName(result.getStoredFilename())
                            .filePath(result.getWebPath())  // 웹 경로 저장 (/uploads/저장파일명)
                            .fileSize(result.getFileSize())
                            .contentType(result.getContentType())
                            .refId(refId)
                            .refType(refType)
                            .fileUsage(usage)
                            .build();

                    fileRepository.save(fileEntity);

                    log.info("파일 정보 DB 저장 완료 - refId: {}, refType: {}, 파일명: {}, 경로: {}",
                            refId, refType, result.getStoredFilename(), result.getWebPath());

                    return result.getWebPath();  // /uploads/저장파일명 반환
                })
                .toList();
    }

    /**
     * 파일 ID로 파일 정보 조회 (다운로드용)
     * @param fileId 파일 ID
     * @return 파일 엔티티
     * @throws EntityNotFoundException 파일이 없으면 (GlobalExceptionHandler가 404로 처리)
     */
    public FileEntity getFileById(Long fileId) {
        return fileRepository.findById(fileId)
                .orElseThrow(() -> EntityNotFoundException.of("파일", fileId));
    }

    /**
     * 파일 삭제 (메타데이터 + 실제 바이트 함께 삭제).
     * <b>IDOR 방지</b>: 파일이 속한 리소스(글/리뷰)의 작성자만 삭제할 수 있다.
     * @param fileId 삭제할 파일 ID
     * @param username 요청 사용자(소유자 검증용)
     */
    @Transactional
    public void deleteFile(Long fileId, String username) {
        FileEntity fileEntity = fileRepository.findById(fileId)
                .orElseThrow(() -> EntityNotFoundException.of("파일", fileId));

        // IDOR 방지: 파일이 속한 리소스의 작성자인지 확인 (아니면 403)
        assertDeletableBy(fileEntity, username);

        // 메타데이터 + 실제 바이트(버킷/디스크) 함께 삭제 (orphan 파일 방지)
        fileUtil.deleteFile(fileEntity.getFilePath());
        fileRepository.delete(fileEntity);
        log.info("파일 삭제 완료 - fileId: {}, 파일명: {}", fileId, fileEntity.getOriginalFileName());
    }

    /**
     * 파일이 속한 리소스(글/리뷰)의 작성자인지 검증한다. 타인의 파일 삭제(IDOR)를 막는다.
     * DOLL_SHOP/DOLL(운영 데이터) 또는 임시 업로드(refId 없음/0)는 이 엔드포인트로 삭제할 수 없다.
     */
    private void assertDeletableBy(FileEntity file, String username) {
        Long refId = file.getRefId();
        boolean owner = false;
        if (refId != null && refId > 0 && file.getRefType() != null) {
            owner = switch (file.getRefType()) {
                case COMMUNITY -> communityRepository.findById(refId)
                        .map(c -> c.isWrittenBy(username))
                        .orElse(false);
                case REVIEW -> reviewRepository.findById(refId)
                        .map(r -> r.isWrittenBy(username))
                        .orElse(false);
                default -> false; // DOLL_SHOP, DOLL 등은 사용자 삭제 불가
            };
        }
        if (!owner) {
            throw AccessDeniedException.forDelete("파일");
        }
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
