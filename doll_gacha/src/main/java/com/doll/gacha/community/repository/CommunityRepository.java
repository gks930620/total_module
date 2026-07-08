package com.doll.gacha.community.repository;

import com.doll.gacha.community.CommunityEntity;
import org.springframework.data.jpa.repository.JpaRepository;
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
}

