package com.test.test.file.repository;

import static com.test.test.file.entity.QFileEntity.fileEntity;

import com.test.test.file.entity.FileEntity;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;


@RequiredArgsConstructor
public class FileRepositoryCustomImpl implements FileRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<FileEntity> searchFiles(Long refId, FileEntity.RefType refType, FileEntity.Usage fileUsage) {
        return queryFactory
                .selectFrom(fileEntity)
                .where(
                        eqRefId(refId),
                        eqRefType(refType),
                        eqFileUsage(fileUsage)
                )
                .fetch();
    }

    @Override
    public Map<Long, String> findFilePathMapByRefIds(List<Long> refIds, FileEntity.RefType refType, FileEntity.Usage fileUsage) {
        // IN 쿼리로 한 번에 조회
        List<FileEntity> files = queryFactory
                .selectFrom(fileEntity)
                .where(
                        fileEntity.refId.in(refIds),
                        eqRefType(refType),
                        eqFileUsage(fileUsage)
                )
                .fetch();

        // Map으로 변환 (각 refId당 첫 번째 파일)
        return files.stream()
                .collect(Collectors.toMap(
                        FileEntity::getRefId,
                        // DB에 이미 완성된 URL 저장됨 (CDN URL 또는 /uploads/xxx)
                        FileEntity::getFilePath,
                        (existing, replacement) -> existing // 중복 시 첫 번째 유지
                ));
    }

    // 동적 조건 메서드들
    private BooleanExpression eqRefId(Long refId) {
        return refId != null ? fileEntity.refId.eq(refId) : null;
    }

    private BooleanExpression eqRefType(FileEntity.RefType refType) {
        return refType != null ? fileEntity.refType.eq(refType) : null;
    }

    private BooleanExpression eqFileUsage(FileEntity.Usage fileUsage) {
        return fileUsage != null ? fileEntity.fileUsage.eq(fileUsage) : null;
    }
}
