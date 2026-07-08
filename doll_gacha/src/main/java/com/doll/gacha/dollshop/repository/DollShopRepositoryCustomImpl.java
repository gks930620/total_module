package com.doll.gacha.dollshop.repository;

import static com.doll.gacha.dollshop.QDollShop.dollShop;
import static com.doll.gacha.file.entity.QFileEntity.fileEntity;
import static com.doll.gacha.review.QReviewEntity.reviewEntity;

import com.doll.gacha.file.entity.FileEntity;
import com.doll.gacha.dollshop.dto.DollShopListDTO;
import com.doll.gacha.dollshop.dto.DollShopMapDTO;
import com.doll.gacha.dollshop.dto.DollShopSearchDTO;
import com.querydsl.core.types.OrderSpecifier;
import com.querydsl.core.types.Projections;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RequiredArgsConstructor
public class DollShopRepositoryCustomImpl implements DollShopRepositoryCustom {
    private final JPAQueryFactory queryFactory;


    @Override
    public Page<DollShopListDTO> searchByConditions(DollShopSearchDTO searchDTO, Pageable pageable) {
        // 파라미터받는것부터 검색 정렬 정리
         // DTO를 분리 ( DollShopListDTO 만들기 ) , DTO return하기 +  코드 내가 전부 해보기  ==> 이건 AI가 잘 못하는듯
        //확인해보자

        // 1. 데이터 조회 (정렬과 통계 포함)
        List<DollShopListDTO> content = queryFactory
            .select(Projections.fields(DollShopListDTO.class,
                dollShop.id,
                dollShop.businessName,
                dollShop.longitude,
                dollShop.latitude,
                dollShop.address,
                dollShop.totalGameMachines,
                dollShop.phone,
                dollShop.isOperating,
                dollShop.approvalDate,
                dollShop.gubun1,
                dollShop.gubun2,
                // 리뷰 통계 바로 계산 (LEFT JOIN 필요)
                reviewEntity.rating.avg().coalesce(0.0).as("averageRating"),
                reviewEntity.count().as("reviewCount"),
                reviewEntity.machineStrength.avg().coalesce(0.0).as("averageMachineStrength"),
                reviewEntity.largeDollCost.avg().coalesce(0.0).as("averageLargeCost"),
                reviewEntity.mediumDollCost.avg().coalesce(0.0).as("averageMediumCost"),
                reviewEntity.smallDollCost.avg().coalesce(0.0).as("averageSmallCost")
            ))
            .from(dollShop)
            .leftJoin(reviewEntity).on(reviewEntity.dollShop.eq(dollShop).and(reviewEntity.isDeleted.isFalse()))
            .where(
                eqGubun1(searchDTO.getGubun1()),
                eqGubun2(searchDTO.getGubun2()),
                eqIsOperating(),
                containsKeyword(searchDTO.getKeyword())
            )
            .groupBy(dollShop.id)
            .orderBy(getSortOrder(pageable)) // 정렬 동적 처리
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        if (content.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, 0);
        }

        // 2. 썸네일 이미지 매핑 (별도 조회로 N+1 방지)
        List<Long> shopIds = content.stream().map(DollShopListDTO::getId).toList();
        mapThumbnails(content, shopIds);

        // 3. 전체 개수 조회
        Long total = queryFactory
            .select(dollShop.count())
            .from(dollShop)
            .where(
                eqGubun1(searchDTO.getGubun1()),
                eqGubun2(searchDTO.getGubun2()),
                eqIsOperating(),
                containsKeyword(searchDTO.getKeyword())
            )
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);


    }


    // 정렬 조건 처리 메서드 수정
    private OrderSpecifier<?> getSortOrder(Pageable pageable) {
        if (pageable.getSort().isEmpty()) return dollShop.id.desc();

        var sort = pageable.getSort().iterator().next();
        String prop = sort.getProperty();
        boolean isAsc = !sort.isDescending();

        if ("averageRating".equals(prop)) {
            return isAsc ? reviewEntity.rating.avg().asc() : reviewEntity.rating.avg().desc();
        } else if ("reviewCount".equals(prop)) {
            return isAsc ? reviewEntity.count().asc() : reviewEntity.count().desc();
        } else if ("totalGameMachines".equals(prop)) {
            return isAsc ? dollShop.totalGameMachines.asc() : dollShop.totalGameMachines.desc();
        } else if ("averageMachineStrength".equals(prop)) {
            return isAsc ? reviewEntity.machineStrength.avg().asc() : reviewEntity.machineStrength.avg().desc();
        } else if ("averageLargeCost".equals(prop)) {
            return isAsc ? reviewEntity.largeDollCost.avg().asc() : reviewEntity.largeDollCost.avg().desc();
        } else if ("averageMediumCost".equals(prop)) {
            return isAsc ? reviewEntity.mediumDollCost.avg().asc() : reviewEntity.mediumDollCost.avg().desc();
        } else if ("averageSmallCost".equals(prop)) {
            return isAsc ? reviewEntity.smallDollCost.avg().asc() : reviewEntity.smallDollCost.avg().desc();
        }

        return dollShop.id.desc();
    }

    // 이미지 매핑 로직 분리
    private void mapThumbnails(List<DollShopListDTO> content, List<Long> shopIds) {
        Map<Long, String> imageMap = queryFactory
            .select(fileEntity.refId, fileEntity.storedFileName)
            .from(fileEntity)
            .where(
                fileEntity.refId.in(shopIds),
                fileEntity.refType.eq(FileEntity.RefType.DOLL_SHOP),
                fileEntity.fileUsage.eq(FileEntity.Usage.THUMBNAIL)
            )
            .fetch()
            .stream()
            .collect(Collectors.toMap(
                tuple -> tuple.get(fileEntity.refId),
                tuple -> "/uploads/" + tuple.get(fileEntity.storedFileName),
                (existing, replacement) -> existing
            ));

        content.forEach(dto -> dto.setImagePath(imageMap.getOrDefault(dto.getId(), "/images/default.png")));
    }

    @Override
    public List<DollShopMapDTO> searchForMap(DollShopSearchDTO searchDTO) {
        // 지도용 - 이미지 제외, 페이징 없음, DTO 직접 반환
        return queryFactory
            .select(Projections.fields(DollShopMapDTO.class,
                dollShop.id,
                dollShop.businessName,
                dollShop.address,
                dollShop.phone,
                dollShop.longitude,
                dollShop.latitude,
                dollShop.totalGameMachines,
                dollShop.approvalDate,
                dollShop.isOperating
            ))
            .from(dollShop)
            .where(
                eqGubun1(searchDTO.getGubun1()),
                eqGubun2(searchDTO.getGubun2()),
                eqIsOperating()
            )
            .orderBy(dollShop.id.desc())
            .fetch();
    }



    private BooleanExpression eqGubun1(String gubun1) {
        return gubun1 != null && !gubun1.isEmpty() ? dollShop.gubun1.eq(gubun1) : null;
    }

    private BooleanExpression eqGubun2(String gubun2) {
        return gubun2 != null && !gubun2.isEmpty() ? dollShop.gubun2.eq(gubun2) : null;
    }

    // 항상 운영중인것만 보이게
    private BooleanExpression eqIsOperating() {
        return dollShop.isOperating.eq(true);
    }

    private BooleanExpression containsKeyword(String keyword) {
        return keyword != null && !keyword.isEmpty() ?
            dollShop.businessName.containsIgnoreCase(keyword)
            .or(dollShop.address.containsIgnoreCase(keyword)) : null;
    }


}
