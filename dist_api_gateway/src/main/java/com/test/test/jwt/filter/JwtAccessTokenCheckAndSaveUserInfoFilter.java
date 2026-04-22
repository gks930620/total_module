package com.test.test.jwt.filter;

import com.test.test.jwt.JwtUtil;
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

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String token = getTokenFromRequest(request);
        if (token == null) {
            chain.doFilter(request, response);
            return;
        }

        try {
            String tokenType = jwtUtil.getTokenType(token);
            if ("refresh".equals(tokenType)) {
                // Refresh token can pass through to /api/tokens/refresh.
                chain.doFilter(request, response);
                return;
            }

            if (!jwtUtil.validateToken(token)) {
                request.setAttribute("ERROR_CAUSE", "TOKEN_EXPIRED");
                chain.doFilter(request, response);
                return;
            }

            String username = jwtUtil.extractUsername(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            UsernamePasswordAuthenticationToken authenticationToken =
                    new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
            authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            chain.doFilter(request, response);
        } catch (JwtException e) {
            request.setAttribute("ERROR_CAUSE", "INVALID_TOKEN");
            chain.doFilter(request, response);
        } catch (UsernameNotFoundException e) {
            log.warn("User from JWT token not found: {}", e.getMessage());

            Cookie accessTokenCookie = new Cookie("access_token", null);
            accessTokenCookie.setMaxAge(0);
            accessTokenCookie.setPath("/");
            response.addCookie(accessTokenCookie);

            Cookie refreshTokenCookie = new Cookie("refresh_token", null);
            refreshTokenCookie.setMaxAge(0);
            refreshTokenCookie.setPath("/");
            response.addCookie(refreshTokenCookie);

            chain.doFilter(request, response);
        }
    }

    private String getTokenFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

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
