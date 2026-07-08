package com.doll.gacha.review.repository;

import com.doll.gacha.review.ReviewEntity;
import com.doll.gacha.review.dto.ReviewStatsDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface ReviewRepository extends JpaRepository<ReviewEntity, Long>, ReviewRepositoryCustom {


    boolean existsByUser_IdAndDollShop_IdAndCreatedAtBetweenAndIsDeletedFalse(Long userId, Long dollShopId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT new com.doll.gacha.review.dto.ReviewStatsDTO(" +
    " COUNT(r)," +
    " AVG(r.rating)," +
    " AVG(r.machineStrength)," +
    " AVG(r.largeDollCost)," +
    " AVG(r.mediumDollCost)," +
    " AVG(r.smallDollCost)" +
    " )" +
    " FROM ReviewEntity r" +
    " WHERE r.dollShop.id = :dollShopId" +
    " AND r.isDeleted = false")
    ReviewStatsDTO findStatsByDollShopId(@Param("dollShopId") Long dollShopId);
}
