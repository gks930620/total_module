package com.doll.gacha.jwt.service;

import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.model.UserDTO;
import com.doll.gacha.jwt.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserEntity userEntity = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + username));

        UserDTO userDTO = UserDTO.from(userEntity);
        return new CustomUserAccount(userDTO);
    }
}