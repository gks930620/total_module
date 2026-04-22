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

    @Transactional
    public UserEntity syncUser(UserSyncRequest request) {
        if (request.getId() == null || request.getId().isBlank()) {
            throw new BusinessRuleException("user id는 필수입니다.");
        }

        return userRepository.findById(request.getId())
                .map(existing -> {
                    existing.updateProfile(request.getProvider(), request.getEmail(), request.getNickname());
                    return existing;
                })
                .orElseGet(() -> userRepository.save(request.toEntity()));
    }
}
