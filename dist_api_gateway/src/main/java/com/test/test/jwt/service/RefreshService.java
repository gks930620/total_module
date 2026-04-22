package com.test.test.jwt.service;


import com.businesscard.common.exception.EntityNotFoundException;
import com.test.test.jwt.JwtUtil;
import com.test.test.jwt.entity.RefreshEntity;
import com.test.test.jwt.entity.UserEntity;
import com.test.test.jwt.repository.RefreshRepository;
import com.test.test.jwt.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RefreshService {
    private final RefreshRepository refreshRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;


    @Transactional(readOnly = true)
    public RefreshEntity getRefresh(String token) {
        return refreshRepository.findByToken(token);
    }

    @Transactional
    public void saveRefresh(String token) {
        String username = jwtUtil.extractUsername(token);
        refreshRepository.deleteByUserEntity_Username(username);

        RefreshEntity refreshEntity = new RefreshEntity();
        UserEntity user = userRepository.findByUsername(username)
                .orElseThrow(() -> EntityNotFoundException.of("사용자", username));
        refreshEntity.setUserEntity(user);
        refreshEntity.setToken(token);
        refreshRepository.save(refreshEntity);
    }

    @Transactional
    public void deleteRefresh(String token) {
        refreshRepository.deleteByToken(token);
    }
}
