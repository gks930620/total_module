package com.doll.gacha.jwt.entity;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.core.types.dsl.PathInits;


/**
 * QRefreshEntity is a Querydsl query type for RefreshEntity
 */
@Generated("com.querydsl.codegen.DefaultEntitySerializer")
public class QRefreshEntity extends EntityPathBase<RefreshEntity> {

    private static final long serialVersionUID = -553030020L;

    private static final PathInits INITS = PathInits.DIRECT2;

    public static final QRefreshEntity refreshEntity = new QRefreshEntity("refreshEntity");

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath token = createString("token");

    public final QUserEntity userEntity;

    public QRefreshEntity(String variable) {
        this(RefreshEntity.class, forVariable(variable), INITS);
    }

    public QRefreshEntity(Path<? extends RefreshEntity> path) {
        this(path.getType(), path.getMetadata(), PathInits.getFor(path.getMetadata(), INITS));
    }

    public QRefreshEntity(PathMetadata metadata) {
        this(metadata, PathInits.getFor(metadata, INITS));
    }

    public QRefreshEntity(PathMetadata metadata, PathInits inits) {
        this(RefreshEntity.class, metadata, inits);
    }

    public QRefreshEntity(Class<? extends RefreshEntity> type, PathMetadata metadata, PathInits inits) {
        super(type, metadata, inits);
        this.userEntity = inits.isInitialized("userEntity") ? new QUserEntity(forProperty("userEntity")) : null;
    }

}

