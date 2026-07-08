package com.doll.gacha.community;

import com.doll.gacha.common.exception.AccessDeniedException;
import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.community.dto.CommunityCreateDTO;
import com.doll.gacha.community.dto.CommunityDTO;
import com.doll.gacha.community.dto.CommunityUpdateDTO;
import com.doll.gacha.community.repository.CommunityRepository;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommunityService {

    private final CommunityRepository communityRepository;
    private final UserRepository userRepository;

    /**
     * 게시글 작성
     */
    @Transactional
    public Long createCommunity(CommunityCreateDTO createDTO, String username) {
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> EntityNotFoundException.of("사용자", username));
        CommunityEntity community = createDTO.toEntity(user);
        CommunityEntity savedCommunity = communityRepository.save(community);
        return savedCommunity.getId();
    }

    /**
     * 게시글 목록 조회 / 검색 (페이징)
     */
    public Page<CommunityDTO> getCommunityList(String searchType, String keyword, Pageable pageable) {
        // Repository에서 직접 DTO로 조회 (카운트 쿼리 최적화 포함)
        return communityRepository.searchCommunity(searchType, keyword, pageable);
    }

    /**
     * 게시글 상세 조회 (조회수 증가)
     * 파일 정보는 클라이언트에서 별도 API로 조회 (/api/files?refId={id}&refType=COMMUNITY)
     */
    @Transactional
    public CommunityDTO getCommunityDetail(Long communityId) {
        CommunityEntity community = communityRepository.findByIdAndIsDeletedFalse(communityId)
            .orElseThrow(() -> EntityNotFoundException.of("게시글", communityId));

        community.incrementViewCount();

        return CommunityDTO.from(community, List.of(), List.of());
    }

    /**
     * 게시글 수정
     */
    @Transactional
    public void updateCommunity(Long communityId, CommunityUpdateDTO updateDTO, String username) {
        CommunityEntity community = communityRepository.findByIdAndIsDeletedFalse(communityId)
                .orElseThrow(() -> EntityNotFoundException.of("게시글", communityId));

        if (!community.isWrittenBy(username)) {
            throw AccessDeniedException.forUpdate("게시글");
        }

        community.update(updateDTO.getTitle(), updateDTO.getContent());
    }

    /**
     * 게시글 삭제 (Soft Delete)
     */
    @Transactional
    public void deleteCommunity(Long communityId, String username) {
        CommunityEntity community = communityRepository.findByIdAndIsDeletedFalse(communityId)
            .orElseThrow(() -> EntityNotFoundException.of("게시글", communityId));

        if (!community.isWrittenBy(username)) {
            throw AccessDeniedException.forDelete("게시글");
        }

        community.softDelete();
    }

}
