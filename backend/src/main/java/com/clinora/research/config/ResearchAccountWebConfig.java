package com.clinora.research.config;

import com.clinora.research.service.ResearchAccessGuard;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class ResearchAccountWebConfig implements WebMvcConfigurer {
    private final ResearchAccessGuard guard;
    public ResearchAccountWebConfig(ResearchAccessGuard guard) { this.guard = guard; }
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(jakarta.servlet.http.HttpServletRequest request,
                    jakarta.servlet.http.HttpServletResponse response, Object handler) {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof Jwt jwt && "RESEARCHER".equals(jwt.getClaimAsString("role"))) {
                    guard.token(jwt);
                }
                return true;
            }
        }).addPathPatterns("/api/**");
    }
}
