package com.doll.gacha.jwt.service;

import com.doll.gacha.common.exception.DuplicateResourceException;
import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.model.JoinDTO;
import com.doll.gacha.jwt.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class JoinService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void joinProcess(JoinDTO joinDTO) {
        // 중복 체크: 이미 존재하면 예외 발생
        if (userRepository.existsByUsername(joinDTO.getUsername())) {
            throw new DuplicateResourceException("이미 사용 중인 아이디입니다: " + joinDTO.getUsername());
        }

        // 이메일 중복 체크 (선택)
        if (joinDTO.getEmail() != null && userRepository.existsByEmail(joinDTO.getEmail())) {
            throw new DuplicateResourceException("이미 사용 중인 이메일입니다: " + joinDTO.getEmail());
        }

        UserEntity user = new UserEntity();
        user.setUsername(joinDTO.getUsername());
        user.setPassword(passwordEncoder.encode(joinDTO.getPassword()));
        user.setEmail(joinDTO.getEmail());
        user.setNickname(joinDTO.getNickname());
        user.setProvider("LOCAL");
        user.getRoles().add("USER");

        userRepository.save(user);
    }
}