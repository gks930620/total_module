package com.doll.gacha.jwt.repository;

import jakarta.annotation.PreDestroy;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;

/**
 * OAuth2 인증 요청을 메모리에 임시 저장하는 Repository
 * - config가 아닌 repository 패키지로 이동 (역할에 맞는 패키지 분리)
 * - TODO: 서버 다중화 시 Redis로 변경 필요 (현재 단일 인스턴스 전제)
 * - 만료 정리는 저장할 때마다 스레드를 새로 만들지 않고, 단일 스케줄러에 지연 작업만 등록한다.
 */
@Slf4j
@Component
public class InMemoryAuthorizationRequestRepository implements
    AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final long EXPIRE_MINUTES = 5;

    // 지금은 Map이지만 서버 다중화 시 Redis로 변경 필요
    // 내 서버1 -> 카카오 -> 내 서버2로 올 때 Redis를 통해 state를 조회
    private final Map<String, OAuth2AuthorizationRequest> authorizationRequests = new ConcurrentHashMap<>();

    // 만료 정리 전용 단일 스케줄러 (저장마다 new Thread 생성 방지)
    private final ScheduledExecutorService cleanupScheduler =
        Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "oauth2-authreq-cleanup");
            t.setDaemon(true);
            return t;
        });

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        String state = request.getParameter("state");
        if (state == null) {
            return null;
        }
        return authorizationRequests.get(state);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest, HttpServletRequest request, HttpServletResponse response) {
        if (authorizationRequest == null) {
            return;
        }

        String state = authorizationRequest.getState();
        authorizationRequests.put(state, authorizationRequest);

        log.debug("OAuth2AuthorizationRequest 저장: {}", state);

        // 5분 후 자동 삭제 (보안 상 Authorization Request를 계속 들고 있을 필요 없음)
        cleanupScheduler.schedule(() -> {
            if (authorizationRequests.remove(state) != null) {
                log.debug("OAuth2AuthorizationRequest 만료 삭제: {}", state);
            }
        }, EXPIRE_MINUTES, TimeUnit.MINUTES);
    }

    // OAuth2 로그인 성공 후 리다이렉트 되었을 때, Spring Security 필터에 의해 호출됨
    // (여기서 삭제하지 않고 SuccessHandler 가 deleteAuthorizationRequest 로 명시적 삭제)
    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request, HttpServletResponse response) {
        String state = request.getParameter("state");
        if (state == null) {
            return null;
        }
        log.debug("OAuth2AuthorizationRequest 조회 (삭제 안 함): {}", state);
        return authorizationRequests.get(state);
    }

    // 로그인 성공 후 명시적으로 삭제하기 위한 메서드 (SuccessHandler에서 호출)
    public void deleteAuthorizationRequest(String state) {
        if (state != null && authorizationRequests.remove(state) != null) {
            log.debug("OAuth2AuthorizationRequest 명시적 삭제 완료: {}", state);
        }
    }

    @PreDestroy
    public void shutdown() {
        cleanupScheduler.shutdownNow();
    }
}
