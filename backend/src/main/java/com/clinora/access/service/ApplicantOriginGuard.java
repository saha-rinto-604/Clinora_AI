package com.clinora.access.service;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.config.CorsProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ApplicantOriginGuard {

    private final CorsProperties corsProperties;

    public ApplicantOriginGuard(CorsProperties corsProperties) {
        this.corsProperties = corsProperties;
    }

    public void requireAllowed(String origin) {
        // Browser cookie-authenticated mutations send Origin. Allowing it to be
        // absent keeps CLI/manual API testing possible while rejecting a
        // browser-supplied cross-site origin.
        if (origin == null || origin.isBlank()) {
            return;
        }
        if (!corsProperties.getAllowedOrigins().contains(origin)) {
            throw new AccessApplicationException(
                HttpStatus.FORBIDDEN,
                "ORIGIN_NOT_ALLOWED",
                "The request origin is not allowed."
            );
        }
    }
}
