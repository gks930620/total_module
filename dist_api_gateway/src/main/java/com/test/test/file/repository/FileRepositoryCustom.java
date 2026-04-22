package com.test.test.file.repository;

import com.test.test.file.entity.FileEntity;

import java.util.List;
import java.util.Map;

public interface FileRepositoryCustom {
    /**
     * 동적 조건으로 파일 검색
     * @param refId 참조 ID
     * @param refType 참조 타입
     * @param fileUsage 파일 용도 (선택)
     * @return 파일 엔티티 리스트
     */
    List<FileEntity> searchFiles(Long refId, FileEntity.RefType refType, FileEntity.Usage fileUsage);

    /**
     * 여러 refId의 파일을 조회하여 Map으로 반환 (N+1 방지)
     * @param refIds 참조 ID 리스트
     * @param refType 참조 타입
     * @param fileUsage 파일 용도
     * @return Map<refId, filePath> (각 refId당 첫 번째 파일 경로)
     */
    Map<Long, String> findFilePathMapByRefIds(List<Long> refIds, FileEntity.RefType refType, FileEntity.Usage fileUsage);
}

