package com.doll.gacha.jwt;

import com.doll.gacha.jwt.entity.UserEntity;
import com.doll.gacha.jwt.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * roles 를 @ElementCollection(user_roles 정규화 테이블)로 매핑한 것에 대한 검증.
 * (기존: @ElementCollection 없이 List<String> → Hibernate 직렬화 BLOB 저장, 1정규화 위반)
 */
@SpringBootTest
@Transactional
@DisplayName("UserEntity roles @ElementCollection 영속성")
class UserRolesPersistenceTest {

    @Autowired
    private UserRepository userRepository;

    @PersistenceContext
    private EntityManager em;

    @Test
    @DisplayName("roles 는 user_roles 테이블에 저장되고 재조회 시 복원된다")
    void rolesPersistAndReload() {
        UserEntity u = UserEntity.builder()
            .username("roleuser")
            .password("x")
            .email("r@e.com")
            .nickname("롤테스터")
            .provider("LOCAL")
            .roles(new ArrayList<>(List.of("USER", "ADMIN")))
            .build();
        userRepository.save(u);
        em.flush();
        em.clear(); // 1차 캐시 비워 실제 DB 재조회 강제

        UserEntity found = userRepository.findByUsername("roleuser").orElseThrow();
        assertThat(found.getRoles()).containsExactlyInAnyOrder("USER", "ADMIN");
    }

    @Test
    @DisplayName("시드 사용자는 user_roles 시드로 USER 권한을 가진다")
    void seedUserHasUserRole() {
        UserEntity seed = userRepository.findByUsername("user4").orElseThrow();
        assertThat(seed.getRoles()).contains("USER");
    }
}
