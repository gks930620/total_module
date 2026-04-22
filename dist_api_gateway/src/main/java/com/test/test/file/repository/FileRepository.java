package com.test.test.file.repository;

import com.test.test.file.entity.FileEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public interface FileRepository extends JpaRepository<FileEntity, Long>, FileRepositoryCustom {
    // N+1 방지를 위한 IN 쿼리
    List<FileEntity> findByRefIdInAndRefType(List<Long> refIds, FileEntity.RefType refType);

    /**
     * 여러 refId의 파일 URL을 Map으로 반환 (N+1 방지용 편의 메서드)
     * @param refIds 참조 ID 리스트
     * @param refType 참조 타입
     * @return Map<refId, List<fileUrl>>
     */
    default Map<Long, List<String>> findFileUrlsMapByRefIds(List<Long> refIds, FileEntity.RefType refType) {
        if (refIds == null || refIds.isEmpty()) {
            return Map.of();
        }

        return findByRefIdInAndRefType(refIds, refType).stream()
                .collect(Collectors.groupingBy(
                        FileEntity::getRefId,
                        Collectors.mapping(
                                // DB에 이미 완성된 URL 저장됨 (CDN URL 또는 /uploads/xxx)
                                FileEntity::getFilePath,
                                Collectors.toList()
                        )
                ));
    }
}
