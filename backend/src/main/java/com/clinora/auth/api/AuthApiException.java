package com.clinora.auth.api;

import java.time.Duration;
import org.springframework.http.HttpStatus;

public class AuthApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;
    private final Duration retryAfter;

    public AuthApiException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, Duration.ZERO);
    }

    public AuthApiException(HttpStatus status, String errorCode, String message, Duration retryAfter) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.retryAfter = retryAfter == null ? Duration.ZERO : retryAfter;
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
    public Duration getRetryAfter() { return retryAfter; }

    public static AuthApiException invalidCredentials() {
        return new AuthApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }

    public static AuthApiException invalidToken() {
        return new AuthApiException(
            HttpStatus.BAD_REQUEST,
            "TOKEN_INVALID",
            "The link is invalid, expired, or has already been used."
        );
    }

    public static AuthApiException sessionInvalid() {
        return new AuthApiException(
            HttpStatus.UNAUTHORIZED,
            "SESSION_INVALID",
            "Your session is invalid or has expired."
        );
    }

    public static AuthApiException rateLimited(Duration retryAfter) {
        return new AuthApiException(
            HttpStatus.TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "Too many requests. Please try again later.",
            retryAfter
        );
    }
}
