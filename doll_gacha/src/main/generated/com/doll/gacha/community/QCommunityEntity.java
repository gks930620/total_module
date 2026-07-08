package com.doll.gacha.community;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.core.types.dsl.PathInits;


/**
 * QCommunityEntity is a Querydsl query type for CommunityEntity
 */
@Generated("com.querydsl.codegen.DefaultEntitySerializer")
public class QCommunityEntity extends EntityPathBase<CommunityEntity> {

    private static final long serialVersionUID = -64979643L;

    private static final PathInits INITS = PathInits.DIRECT2;

    public static final QCommunityEntity communityEntity = new QCommunityEntity("communityEntity");

    public final StringPath content = createString("content");

    public final DateTimePath<java.time.LocalDateTime> createdAt = createDateTime("createdAt", java.time.LocalDateTime.class);

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final BooleanPath isDeleted = createBoolean("isDeleted");

    public final StringPath title = createString("title");

    public final DateTimePath<java.time.LocalDateTime> updatedAt = createDateTime("updatedAt", java.time.LocalDateTime.class);

    public final com.doll.gacha.jwt.entity.QUserEntity user;

    public final NumberPath<Integer> viewCount = createNumber("viewCount", Integer.class);

    public QCommunityEntity(String variable) {
        this(CommunityEntity.class, forVariable(variable), INITS);
    }

    public QCommunityEntity(Path<? extends CommunityEntity> path) {
        this(path.getType(), path.getMetadata(), PathInits.getFor(path.getMetadata(), INITS));
    }

    public QCommunityEntity(PathMetadata metadata) {
        this(metadata, PathInits.getFor(metadata, INITS));
    }

    public QCommunityEntity(PathMetadata metadata, PathInits inits) {
        this(CommunityEntity.class, metadata, inits);
    }

    public QCommunityEntity(Class<? extends CommunityEntity> type, PathMetadata metadata, PathInits inits) {
        super(type, metadata, inits);
        this.user = inits.isInitialized("user") ? new com.doll.gacha.jwt.entity.QUserEntity(forProperty("user")) : null;
    }

}

