package com.doll.gacha.jwt.model;

import com.doll.gacha.jwt.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    private Long id;

    private String provider;  // Oauth2Provider 이름.
    private String username;

    private String password;

    private String email;
    private String nickname;

    @Builder.Default
    private List<String> roles=new ArrayList<>();

    public static UserDTO from(UserEntity userEntity) {
        return UserDTO.builder()
            .id(userEntity.getId())
            .provider(userEntity.getProvider())
            .username(userEntity.getUsername())
            .password(userEntity.getPassword())
            .email(userEntity.getEmail())
            .nickname(userEntity.getNickname())
            .roles(userEntity.getRoles() != null ? userEntity.getRoles() : new ArrayList<>())
            .build();
    }

    public UserEntity toEntity() {
        return UserEntity.builder()
            .id(this.id)
            .provider(this.provider)
            .username(this.username)
            .password(this.password)
            .email(this.email)
            .nickname(this.nickname)
            .roles(this.roles)
            .build();
    }
}
