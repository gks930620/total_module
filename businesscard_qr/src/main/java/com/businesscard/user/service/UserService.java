package com.businesscard.user.service;

import com.businesscard.common.exception.BusinessRuleException;
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
