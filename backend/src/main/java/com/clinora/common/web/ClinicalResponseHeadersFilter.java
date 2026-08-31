package com.clinora.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ClinicalResponseHeadersFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String path = request.getRequestURI();
        if (path.startsWith("/api/v1/patient/") || path.startsWith("/api/v1/doctor/")) {
            response.setHeader("Cache-Control", "private, no-store, max-age=0");
            response.setHeader("Pragma", "no-cache");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("Referrer-Policy", "no-referrer");
            response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        }
        chain.doFilter(request, response);
    }
}

