package com.doll.gacha.jwt.filter;

import com.doll.gacha.jwt.JwtUtil;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Slf4j
@RequiredArgsConstructor
public class JwtAccessTokenCheckAndSaveUserInfoFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;  //단순히  jwt기능제공
    private final UserDetailsService userDetailsService;  //내가만들고 빈 등록한 CustomUserDetailsService

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
        FilterChain chain)
        throws ServletException, IOException {

        String token = getTokenFromRequest(request);

        if (token == null) {
            chain.doFilter(request, response);
            return;
        }

        try {
            //token은 access 아니면 refresh 2개뿐 ("refresh" 리터럴을 앞에 두어 null NPE 방지)
            String tokenType = jwtUtil.getTokenType(token);
            if ("refresh".equals(tokenType)) {
                chain.doFilter(request, response);   //refresh토큰이 있다 => /api/refresh/reissue는 인증 필요없는 곳 무사통과
                return;
            }

            //access token에 대해서....
            if (!jwtUtil.validateToken(token)) { //토큰이 문제 있다면.. jwtUtil에 문제가 없다면 만료되었을 때만.
                request.setAttribute("ERROR_CAUSE", "토큰만료");
                chain.doFilter(request, response);   // access_token이 만료된거라면 인증필요한 url => security가 authenticationException
                return;
            }

            //만료 안 되었다면 SecurityContext에 인증정보 담아 로그인한걸로 판단!!
            String username = jwtUtil.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(
                username); //내가 만든 CustomUserAccount
            UsernamePasswordAuthenticationToken authenticationToken =
                new UsernamePasswordAuthenticationToken(userDetails, null,
                    userDetails.getAuthorities());
            authenticationToken.setDetails(
                new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authenticationToken);  //이걸 해야 비로소 securityConfig가 로그인한 걸로 간주
            chain.doFilter(request, response);  //인증된 상태로 통과!
        } catch (JwtException e) {
            // 잘못된 토큰 형식 등 JWT 파싱 실패 시
            request.setAttribute("ERROR_CAUSE", "잘못된토큰");
            chain.doFilter(request, response);  // 인증 없이 통과 -> authenticationEntryPoint에서 처리
        } catch (UsernameNotFoundException e) {
            // DB에 사용자가 없는 경우 (로컬 DB와 Docker DB가 다를 때 발생)
            log.warn("JWT 토큰의 사용자가 DB에 없음: {}. 쿠키 삭제 후 비로그인 상태로 처리", e.getMessage());
            // 쿠키 삭제
            Cookie accessTokenCookie = new Cookie("access_token", null);
            accessTokenCookie.setMaxAge(0);
            accessTokenCookie.setPath("/");
            response.addCookie(accessTokenCookie);

            Cookie refreshTokenCookie = new Cookie("refresh_token", null);
            refreshTokenCookie.setMaxAge(0);
            refreshTokenCookie.setPath("/");
            response.addCookie(refreshTokenCookie);

            chain.doFilter(request, response);  // 인증 없이 통과
        }
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        // 1. 우선 Authorization 헤더에서 찾음 (앱이나 특정 API 호출용)
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // 2. 헤더에 없으면 쿠키에서 찾음 (브라우저용)
        if (request.getCookies() != null) {
            return Arrays.stream(request.getCookies())
                .filter(cookie -> "access_token".equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
        }
        return null;
    }


}