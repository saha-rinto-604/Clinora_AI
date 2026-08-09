package com.clinora.access.api;

import java.time.Duration;
import org.springframework.http.HttpStatus;

public class AccessApplicationException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    private final Duration retryAfter;

    public AccessApplicationException(HttpStatus status, String errorCode, String message) {
        this(status, errorCode, message, Duration.ZERO);
    }

    public AccessApplicationException(HttpStatus status, String errorCode, String message, Duration retryAfter) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
        this.retryAfter = retryAfter == null ? Duration.ZERO : retryAfter;
    }

    public HttpStatus getStatus() { return status; }
    public String getErrorCode() { return errorCode; }
    public Duration getRetryAfter() { return retryAfter; }

    public static AccessApplicationException invalidToken() {
        return new AccessApplicationException(HttpStatus.BAD_REQUEST, "APPLICATION_TOKEN_INVALID", "The application link is invalid, expired, or has already been used.");
    }
    public static AccessApplicationException verificationAlreadyUsed() {
        return new AccessApplicationException(HttpStatus.CONFLICT, "APPLICATION_VERIFICATION_ALREADY_USED", "This verification link has already been used. Resume your application with a secure resume link.");
    }
    public static AccessApplicationException verificationExpired() {
        return new AccessApplicationException(HttpStatus.BAD_REQUEST, "APPLICATION_VERIFICATION_EXPIRED", "This verification link has expired. Send a new verification email to continue.");
    }
    public static AccessApplicationException sessionInvalid() {
        return new AccessApplicationException(HttpStatus.UNAUTHORIZED, "APPLICANT_SESSION_INVALID", "Your applicant session is invalid or has expired.");
    }
    public static AccessApplicationException notEditable() {
        return new AccessApplicationException(HttpStatus.CONFLICT, "APPLICATION_NOT_EDITABLE", "This application is no longer editable.");
    }
    public static AccessApplicationException validation(String message) {
        return new AccessApplicationException(HttpStatus.BAD_REQUEST, "APPLICATION_NOT_READY_FOR_REVIEW", message);
    }
    public static AccessApplicationException rateLimited(Duration retryAfter) {
        return new AccessApplicationException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests. Please try again later.", retryAfter);
    }
}
