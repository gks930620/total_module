package com.doll.gacha.file.entity;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;


/**
 * QFileEntity is a Querydsl query type for FileEntity
 */
@Generated("com.querydsl.codegen.DefaultEntitySerializer")
public class QFileEntity extends EntityPathBase<FileEntity> {

    private static final long serialVersionUID = -1423908838L;

    public static final QFileEntity fileEntity = new QFileEntity("fileEntity");

    public final StringPath contentType = createString("contentType");

    public final DateTimePath<java.time.LocalDateTime> createdAt = createDateTime("createdAt", java.time.LocalDateTime.class);

    public final StringPath filePath = createString("filePath");

    public final NumberPath<Long> fileSize = createNumber("fileSize", Long.class);

    public final EnumPath<FileEntity.Usage> fileUsage = createEnum("fileUsage", FileEntity.Usage.class);

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath originalFileName = createString("originalFileName");

    public final NumberPath<Long> refId = createNumber("refId", Long.class);

    public final EnumPath<FileEntity.RefType> refType = createEnum("refType", FileEntity.RefType.class);

    public final StringPath storedFileName = createString("storedFileName");

    public final DateTimePath<java.time.LocalDateTime> updatedAt = createDateTime("updatedAt", java.time.LocalDateTime.class);

    public QFileEntity(String variable) {
        super(FileEntity.class, forVariable(variable));
    }

    public QFileEntity(Path<? extends FileEntity> path) {
        super(path.getType(), path.getMetadata());
    }

    public QFileEntity(PathMetadata metadata) {
        super(FileEntity.class, metadata);
    }

}

