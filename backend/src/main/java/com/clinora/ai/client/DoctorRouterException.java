package com.clinora.ai.client;

import org.springframework.web.client.RestClientException;

/** Sanitized failure metadata; never retains downstream bodies, clinical text or credentials. */
public class DoctorRouterException extends RestClientException {
    public enum Category {
        ROUTER_CONNECTION_FAILURE, ROUTER_SERVICE_UNAVAILABLE, ROUTER_MODEL_UNAVAILABLE,
        ROUTER_MODEL_BUSY, ROUTER_TIMEOUT, ROUTER_AUTH_CONFIGURATION_ERROR, ROUTER_INVALID_RESPONSE
    }

    private final Category category;
    private final boolean clarificationSafe;

    public DoctorRouterException(Category category, boolean clarificationSafe) {
        super(category.name());
        this.category = category;
        this.clarificationSafe = clarificationSafe;
    }

    public Category category() { return category; }
    public boolean clarificationSafe() { return clarificationSafe; }
}
