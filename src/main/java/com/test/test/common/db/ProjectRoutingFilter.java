package com.test.test.common.db;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class ProjectRoutingFilter extends OncePerRequestFilter {

    private final ProjectDataSourceProperties properties;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String projectId = resolveProjectId(request.getRequestURI());
        ProjectDbContextHolder.setProjectId(projectId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            ProjectDbContextHolder.clear();
        }
    }

    private String resolveProjectId(String requestUri) {
        if (!StringUtils.hasText(requestUri)) {
            return properties.getDefaultProject();
        }

        String normalized = requestUri.startsWith("/") ? requestUri.substring(1) : requestUri;
        int slashIndex = normalized.indexOf('/');
        String candidate = slashIndex >= 0 ? normalized.substring(0, slashIndex) : normalized;

        if (properties.getProjects().containsKey(candidate)) {
            return candidate;
        }
        return properties.getDefaultProject();
    }
}
