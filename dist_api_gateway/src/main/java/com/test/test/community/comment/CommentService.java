package com.test.test.community.comment;

import com.businesscard.common.exception.AccessDeniedException;
import com.businesscard.common.exception.EntityNotFoundException;
import com.test.test.community.CommunityEntity;
import com.test.test.community.comment.dto.CommentCreateDTO;
import com.test.test.community.comment.dto.CommentDTO;
import com.test.test.community.comment.dto.CommentUpdateDTO;
import com.test.test.community.comment.repository.CommentRepository;
import com.test.test.community.repository.CommunityRepository;
import com.test.test.jwt.entity.UserEntity;
import com.test.test.jwt.repository.UserRepository;
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

    public Page<CommentDTO> getCommentsByCommunityId(Long communityId, Pageable pageable) {
        return commentRepository.findByCommunityIdWithUser(communityId, pageable)
                .map(CommentDTO::from);
    }

    @Transactional
    public CommentDTO createComment(Long communityId, CommentCreateDTO createDTO, String username) {
        CommunityEntity community = communityRepository.findByIdAndIsDeletedFalse(communityId)
                .orElseThrow(() -> EntityNotFoundException.of("Community", communityId));

        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> EntityNotFoundException.of("User", username));

        CommentEntity comment = createDTO.toEntity(community, user);
        return CommentDTO.from(commentRepository.save(comment));
    }

    @Transactional
    public CommentDTO updateComment(Long commentId, CommentUpdateDTO updateDTO, String username) {
        CommentEntity comment = findCommentByIdAndValidateUser(commentId, username);
        comment.update(updateDTO.getContent());
        return CommentDTO.from(comment);
    }

    @Transactional
    public void deleteComment(Long commentId, String username) {
        CommentEntity comment = findCommentByIdAndValidateUser(commentId, username);
        comment.softDelete();
    }

    private CommentEntity findCommentByIdAndValidateUser(Long commentId, String username) {
        CommentEntity comment = commentRepository.findById(commentId)
                .orElseThrow(() -> EntityNotFoundException.of("Comment", commentId));

        if (!comment.isWrittenBy(username)) {
            throw AccessDeniedException.forUpdate("Comment");
        }

        return comment;
    }
}
