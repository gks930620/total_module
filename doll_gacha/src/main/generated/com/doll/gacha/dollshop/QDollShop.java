package com.doll.gacha.dollshop;

import static com.querydsl.core.types.PathMetadataFactory.*;

import com.querydsl.core.types.dsl.*;

import com.querydsl.core.types.PathMetadata;
import javax.annotation.processing.Generated;
import com.querydsl.core.types.Path;


/**
 * QDollShop is a Querydsl query type for DollShop
 */
@Generated("com.querydsl.codegen.DefaultEntitySerializer")
public class QDollShop extends EntityPathBase<DollShop> {

    private static final long serialVersionUID = 1581919692L;

    public static final QDollShop dollShop = new QDollShop("dollShop");

    public final StringPath address = createString("address");

    public final DatePath<java.time.LocalDate> approvalDate = createDate("approvalDate", java.time.LocalDate.class);

    public final StringPath businessName = createString("businessName");

    public final StringPath gubun1 = createString("gubun1");

    public final StringPath gubun2 = createString("gubun2");

    public final NumberPath<Long> id = createNumber("id", Long.class);

    public final StringPath imagePath = createString("imagePath");

    public final BooleanPath isOperating = createBoolean("isOperating");

    public final NumberPath<Double> latitude = createNumber("latitude", Double.class);

    public final NumberPath<Double> longitude = createNumber("longitude", Double.class);

    public final StringPath phone = createString("phone");

    public final NumberPath<Integer> totalGameMachines = createNumber("totalGameMachines", Integer.class);

    public QDollShop(String variable) {
        super(DollShop.class, forVariable(variable));
    }

    public QDollShop(Path<? extends DollShop> path) {
        super(path.getType(), path.getMetadata());
    }

    public QDollShop(PathMetadata metadata) {
        super(DollShop.class, metadata);
    }

}

