package com.doll.gacha.review;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;
import com.querydsl.core.types.dsl.PathInits;


/**
 * QReviewEntity is a Querydsl query type for ReviewEntity
 */
@Generated("com.querydsl.codegen.DefaultEntitySerializer")
public class QReviewEntity extends EntityPathBase<ReviewEntity> {

    private static final long serialVersionUID = 1962516239L;

    private static final PathInits INITS = PathInits.DIRECT2;

    public static final QReviewEntity reviewEntity = new QReviewEntity("reviewEntity");

    public final StringPath content = createString("content");

    public final DateTimePath<java.time.LocalDateTime> createdAt = createDateTime("createdAt", java.time.LocalDateTime.class);

    public final com.doll.gacha.dollshop.QDollShop dollShop;

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final BooleanPath isDeleted = createBoolean("isDeleted");

    public final NumberPath<Integer> largeDollCost = createNumber("largeDollCost", Integer.class);

    public final NumberPath<Integer> machineStrength = createNumber("machineStrength", Integer.class);

    public final NumberPath<Integer> mediumDollCost = createNumber("mediumDollCost", Integer.class);

    public final NumberPath<Integer> rating = createNumber("rating", Integer.class);

    public final NumberPath<Integer> smallDollCost = createNumber("smallDollCost", Integer.class);

    public final DateTimePath<java.time.LocalDateTime> updatedAt = createDateTime("updatedAt", java.time.LocalDateTime.class);

    public final com.doll.gacha.jwt.entity.QUserEntity user;

    public QReviewEntity(String variable) {
        this(ReviewEntity.class, forVariable(variable), INITS);
    }

    public QReviewEntity(Path<? extends ReviewEntity> path) {
        this(path.getType(), path.getMetadata(), PathInits.getFor(path.getMetadata(), INITS));
    }

    public QReviewEntity(PathMetadata metadata) {
        this(metadata, PathInits.getFor(metadata, INITS));
    }

    public QReviewEntity(PathMetadata metadata, PathInits inits) {
        this(ReviewEntity.class, metadata, inits);
    }

    public QReviewEntity(Class<? extends ReviewEntity> type, PathMetadata metadata, PathInits inits) {
        super(type, metadata, inits);
        this.dollShop = inits.isInitialized("dollShop") ? new com.doll.gacha.dollshop.QDollShop(forProperty("dollShop")) : null;
        this.user = inits.isInitialized("user") ? new com.doll.gacha.jwt.entity.QUserEntity(forProperty("user")) : null;
    }

}

