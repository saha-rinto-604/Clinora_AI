package com.clinora.auth.service;

import com.clinora.config.AuthProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class RefreshCookieService {

    public static final String COOKIE_NAME = "clinora_refresh";
    private static final String COOKIE_PATH = "/api/v1/auth";
    private final AuthProperties authProperties;

    public RefreshCookieService(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    public ResponseCookie issue(String token, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, token)
            .httpOnly(true)
            .secure(authProperties.isRefreshCookieSecure())
            .sameSite(authProperties.getRefreshCookieSameSite())
            .path(COOKIE_PATH)
            .maxAge(maxAge)
            .build();
    }

    public ResponseCookie clear() {
        return ResponseCookie.from(COOKIE_NAME, "")
            .httpOnly(true)
            .secure(authProperties.isRefreshCookieSecure())
            .sameSite(authProperties.getRefreshCookieSameSite())
            .path(COOKIE_PATH)
            .maxAge(Duration.ZERO)
            .build();
    }
}
