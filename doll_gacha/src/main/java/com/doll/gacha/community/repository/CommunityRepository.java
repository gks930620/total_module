package com.doll.gacha.community.repository;

import com.doll.gacha.community.CommunityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CommunityRepository extends JpaRepository<CommunityEntity, Long>, CommunityRepositoryCustom {

    /**
     * 삭제되지 않은 게시글 조회 (수정/삭제 시 사용)
     */
    Optional<CommunityEntity> findByIdAndIsDeletedFalse(Long id);

    /**
     * 조회수 원자적 증가 (view_count = view_count + 1) — lost update 방지. 삭제된 글은 증가 안 함.
     */
    @Modifying
    @Query("UPDATE CommunityEntity c SET c.viewCount = c.viewCount + 1 WHERE c.id = :id AND c.isDeleted = false")
    int increaseViewCount(@Param("id") Long id);
}

