package com.doll.gacha.jwt.repository;

import com.doll.gacha.jwt.entity.RefreshEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshRepository  extends JpaRepository<RefreshEntity,Long> {
    void deleteByUserEntity_Username(String username);
    boolean existsByUserEntity_Username(String username);
    public void deleteByToken(String token);
    public RefreshEntity findByToken(String token);
}
