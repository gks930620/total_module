package com.businesscard.user.service;

import com.businesscard.card.entity.BusinessCardEntity;
import com.businesscard.card.repository.BusinessCardRepository;
import com.businesscard.common.exception.BusinessRuleException;
import java.util.List;
import com.businesscard.user.dto.UserSyncRequest;
import com.businesscard.user.entity.UserEntity;
import com.businesscard.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BusinessCardRepository businessCardRepository;

    @Transactional(readOnly = true)
    public boolean existsById(String userId) {
        return userRepository.existsById(userId);
    }

    /**
     * 회원 탈퇴의 DB 부분 — 명함과 계정을 지우고, 지워야 할 이미지 경로를 돌려준다.
     *
     * <p>파일 삭제는 여기서 하지 않는다. 버킷 호출(외부 I/O)이 트랜잭션 안에서 DB 커넥션을
     * 붙잡으면 안 되기 때문이다(코드컨벤션 §1). 호출부는 {@link AccountDeletionService}.
     *
     * <p>구독(결제) 기록은 <b>일부러 지우지 않는다</b> — 전자상거래법상 5년 보관 의무.
     *
     * @return 파기해야 할 명함 이미지의 논리 경로 목록
     */
    @Transactional
    public List<String> purgeAccount(String userId) {
        List<String> imagePaths = businessCardRepository.findByUserId(userId).stream()
                .map(BusinessCardEntity::getBusinessCardImagePath)
                .filter(path -> path != null && !path.isBlank())
                .toList();

        businessCardRepository.deleteByUserId(userId);
        // 이미 탈퇴한 계정으로 다시 요청이 와도 조용히 성공시킨다(멱등).
        // deleteById 대신 이 형태를 쓰는 건 "없으면 아무 일 없음"을 코드로 못박기 위해서다.
        userRepository.findById(userId).ifPresent(userRepository::delete);

        return imagePaths;
    }

    public void validateSyncRequest(String authenticatedUserId, UserSyncRequest request) {
        if (authenticatedUserId == null || authenticatedUserId.isBlank()) {
            throw new BusinessRuleException("authenticated user id is required.");
        }
        if (request.getId() == null || request.getId().isBlank()) {
            throw new BusinessRuleException("user id is required.");
        }
        if (!authenticatedUserId.equals(request.getId())) {
            throw new BusinessRuleException("Authenticated user id and payload id must match.");
        }
    }

    @Transactional
    public UserEntity syncUser(UserSyncRequest request) {
        return userRepository.findById(request.getId())
                .map(existing -> {
                    existing.updateProfile(request.getProvider(), request.getEmail(), request.getNickname());
                    return existing;
                })
                .orElseGet(() -> userRepository.save(request.toEntity()));
    }

    @Transactional
    public UserEntity syncKakaoUser(String kakaoId, String email, String nickname) {
        if (kakaoId == null || kakaoId.isBlank()) {
            throw new BusinessRuleException("kakao id is required.");
        }

        String userId = "kakao_" + kakaoId;
        return userRepository.findById(userId)
                .map(existing -> {
                    existing.updateProfile("kakao", email, nickname);
                    return existing;
                })
                .orElseGet(() -> userRepository.save(UserEntity.builder()
                        .id(userId)
                        .provider("kakao")
                        .email(email)
                        .nickname(nickname)
                        .build()));
    }
}
