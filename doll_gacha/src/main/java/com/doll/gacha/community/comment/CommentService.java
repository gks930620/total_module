package com.doll.gacha.community.comment;

import com.doll.gacha.common.exception.AccessDeniedException;
import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.community.CommunityEntity;
import com.doll.gacha.community.comment.dto.CommentCreateDTO;
import com.doll.gacha.community.comment.dto.CommentDTO;
import com.doll.gacha.community.comment.dto.CommentUpdateDTO;
import com.doll.gacha.community.comment.repository.CommentRepository;
import com.doll.gacha.community.repository.CommunityRepository;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommentService {

    private final CommentRepository commentRepository;
    private final CommunityRepository communityRepository;
    private final UserRepository userRepository;

    /**
     * 특정 게시글의 댓글 목록 조회 (페이징)
     */
    public Page<CommentDTO> getCommentsByCommunityId(Long communityId, Pageable pageable) {
        return commentRepository.findByCommunityIdWithUser(communityId, pageable)
                .map(CommentDTO::from);
    }

    /**
     * 댓글 작성
     */
    @Transactional
    public CommentDTO createComment(CommentCreateDTO createDTO, String username) {
        // 삭제된 게시글에는 댓글을 달 수 없도록 soft-delete 를 무시하지 않는다
        CommunityEntity community = communityRepository.findByIdAndIsDeletedFalse(createDTO.getCommunityId())
                .orElseThrow(() -> EntityNotFoundException.of("게시글", createDTO.getCommunityId()));

        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> EntityNotFoundException.of("사용자", username));

        CommentEntity comment = createDTO.toEntity(community, user);

        return CommentDTO.from(commentRepository.save(comment));
    }

    /**
     * 댓글 수정
     */
    @Transactional
    public CommentDTO updateComment(Long commentId, CommentUpdateDTO updateDTO, String username) {
        CommentEntity comment = findCommentByIdAndValidateUser(commentId, username, AccessDeniedException.forUpdate("댓글"));
        comment.update(updateDTO.getContent());
        return CommentDTO.from(comment);
    }

    /**
     * 댓글 삭제 (소프트 삭제)
     */
    @Transactional
    public void deleteComment(Long commentId, String username) {
        CommentEntity comment = findCommentByIdAndValidateUser(commentId, username, AccessDeniedException.forDelete("댓글"));
        comment.softDelete();
    }

    /**
     * 댓글 조회 및 사용자 검증 공통 메서드
     * (수정/삭제에 따라 적절한 권한 오류 메시지를 전달받아 던진다)
     */
    private CommentEntity findCommentByIdAndValidateUser(Long commentId, String username, AccessDeniedException onDenied) {
        CommentEntity comment = commentRepository.findById(commentId)
                .orElseThrow(() -> EntityNotFoundException.of("댓글", commentId));

        if (!comment.isWrittenBy(username)) {
            throw onDenied;
        }

        return comment;
    }
}
