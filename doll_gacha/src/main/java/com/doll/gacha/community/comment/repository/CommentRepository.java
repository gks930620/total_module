package com.doll.gacha.community.comment.repository;

import com.doll.gacha.community.comment.CommentEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CommentRepository extends JpaRepository<CommentEntity, Long> {

    /**
     * 특정 게시글의 댓글 목록 조회 (삭제되지 않은 것만, User fetch join으로 N+1 방지, 페이징)
     */
    @Query(value = "SELECT c FROM CommentEntity c " +
           "JOIN FETCH c.user " +
           "WHERE c.community.id = :communityId " +
           "AND c.isDeleted = false " +
           "ORDER BY c.createdAt DESC",
           countQuery = "SELECT count(c) FROM CommentEntity c WHERE c.community.id = :communityId AND c.isDeleted = false")
    Page<CommentEntity> findByCommunityIdWithUser(@Param("communityId") Long communityId, Pageable pageable);
}

