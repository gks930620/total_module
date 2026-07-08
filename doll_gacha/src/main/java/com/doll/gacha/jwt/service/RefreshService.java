package com.doll.gacha.jwt.service;


import com.doll.gacha.common.exception.EntityNotFoundException;
import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.entity.RefreshEntity;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.RefreshRepository;
import com.doll.gacha.jwt.repository.UserRepository;
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
