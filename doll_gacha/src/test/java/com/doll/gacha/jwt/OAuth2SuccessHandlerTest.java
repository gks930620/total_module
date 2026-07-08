package com.doll.gacha.jwt;

import com.doll.gacha.jwt.repository.InMemoryAuthorizationRequestRepository;
import com.doll.gacha.jwt.handler.OAuth2LoginSuccessHandler;
import com.doll.gacha.jwt.JwtUtil;
import com.doll.gacha.jwt.model.CustomUserAccount;
import com.doll.gacha.jwt.model.UserDTO;
import com.doll.gacha.jwt.service.RefreshService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.web.RedirectStrategy;

import java.util.HashMap;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class OAuth2SuccessHandlerTest {

    @InjectMocks
    private OAuth2LoginSuccessHandler successHandler;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private RefreshService refreshService;

    @Mock
    private InMemoryAuthorizationRequestRepository authorizationRequestRepository;

    @Mock
    private RedirectStrategy redirectStrategy;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        // RedirectStrategy를 Mock 객체로 교체하여 리다이렉트 URL을 검증할 수 있게 함
        successHandler.setRedirectStrategy(redirectStrategy);
        // @Value 필드는 순수 Mockito 테스트에서 주입되지 않으므로 로컬 기본값을 직접 세팅
        // (운영에서는 환경변수 APP_OAUTH2_REDIRECT_BASE 로 교체 가능)
        org.springframework.test.util.ReflectionTestUtils.setField(
            successHandler, "appRedirectBase", "http://10.0.2.2:8080");
    }

    @Test
    @DisplayName("앱 로그인 성공: 리다이렉트 URL 확인 (10.0.2.2)")
    // [테스트 대상] OAuth2LoginSuccessHandler.onAuthenticationSuccess()의 if ("app".equals(target)) 블록
    // 1. InMemoryAuthorizationRequestRepository에서 target="app" 정보를 가져왔다고 가정 (Mocking)
    // 2. 리다이렉트 URL이 에뮬레이터용 주소(http://10.0.2.2:8080/login/success)로 생성되는지 검증
    // 3. 마지막에 deleteAuthorizationRequest()가 호출되어 메모리를 정리하는지 검증
    void success_App() throws Exception {
        // given
        // 1. 사용자 정보 Mocking
        UserDTO userDTO = UserDTO.builder().username("testuser").build();
        CustomUserAccount userAccount = new CustomUserAccount(userDTO);
        given(authentication.getPrincipal()).willReturn(userAccount);

        // 2. 토큰 생성 Mocking
        given(jwtUtil.createAccessToken(anyString())).willReturn("access_token");
        given(jwtUtil.createRefreshToken(anyString())).willReturn("refresh_token");

        // 3. Request Repository Mocking (target=app)
        OAuth2AuthorizationRequest authRequest = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("http://auth")
                .clientId("client")
                .attributes(attrs -> attrs.put("target", "app"))
                .build();
        given(authorizationRequestRepository.loadAuthorizationRequest(any())).willReturn(authRequest);
        given(request.getParameter("state")).willReturn("state123");

        // when
        successHandler.onAuthenticationSuccess(request, response, authentication);

        // then
        // 1. 리다이렉트 URL 검증 (http://10.0.2.2:8080/login/success...)
        verify(redirectStrategy).sendRedirect(any(), any(),
            org.mockito.ArgumentMatchers.contains("http://10.0.2.2:8080/login/success"));

        // 2. 명시적 삭제 호출 검증
        verify(authorizationRequestRepository).deleteAuthorizationRequest("state123");
    }

    @Test
    @DisplayName("웹 로그인 성공: 쿠키 생성 및 /map 리다이렉트")
    // [테스트 대상] OAuth2LoginSuccessHandler.onAuthenticationSuccess()의 else 블록 (웹 분기)
    // 1. target="web" 정보를 가져왔다고 가정
    // 2. 쿠키(Set-Cookie)가 응답 헤더에 추가되는지 검증
    // 3. 리다이렉트 경로가 "/map" 인지 검증
    void success_Web() throws Exception {
        // given
        UserDTO userDTO = UserDTO.builder().username("testuser").build();
        CustomUserAccount userAccount = new CustomUserAccount(userDTO);
        given(authentication.getPrincipal()).willReturn(userAccount);

        given(jwtUtil.createAccessToken(anyString())).willReturn("access_token");
        given(jwtUtil.createRefreshToken(anyString())).willReturn("refresh_token");

        // target=web (또는 null)
        OAuth2AuthorizationRequest authRequest = OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("http://auth")
                .clientId("client")
                .attributes(attrs -> attrs.put("target", "web"))
                .build();
        given(authorizationRequestRepository.loadAuthorizationRequest(any())).willReturn(authRequest);
        given(request.getParameter("state")).willReturn("state123");

        // when
        successHandler.onAuthenticationSuccess(request, response, authentication);

        // then
        // 1. 쿠키 추가 검증 (Set-Cookie 헤더가 추가되었는지)
        verify(response, org.mockito.Mockito.atLeastOnce()).addHeader(eq("Set-Cookie"), anyString());

        // 2. 리다이렉트 URL 검증 (/map)
        verify(redirectStrategy).sendRedirect(any(), any(), eq("/map"));

        // 3. 명시적 삭제 호출 검증
        verify(authorizationRequestRepository).deleteAuthorizationRequest("state123");
    }
}
