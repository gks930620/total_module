package com.doll.gacha.jwt.model;

import java.util.List;

/**
 * 내 정보 조회(GET /api/my/info) 응답 DTO.
 * UserDTO 를 그대로 노출하면 password 해시가 함께 나가므로, 노출 가능한 필드만 담는다.
 */
public record MyInfoResponse(
        Long id,
        String email,
        String username,
        String nickname,
        String provider,
        List<String> roles
) {
    public static MyInfoResponse from(UserDTO userDTO) {
        return new MyInfoResponse(
                userDTO.getId(),
                userDTO.getEmail(),
                userDTO.getUsername(),
                userDTO.getNickname(),
                userDTO.getProvider(),
                userDTO.getRoles()
        );
    }
}
