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
    public static AccessApplicationException notFound() {
        return new AccessApplicationException(HttpStatus.NOT_FOUND, "APPLICATION_NOT_FOUND", "The requested application was not found.");
    }
    public static AccessApplicationException documentNotFound() {
        return new AccessApplicationException(HttpStatus.NOT_FOUND, "APPLICATION_DOCUMENT_NOT_FOUND", "The requested document was not found.");
    }
    public static AccessApplicationException interviewNotFound() {
        return new AccessApplicationException(HttpStatus.NOT_FOUND, "DOCTOR_INTERVIEW_NOT_FOUND", "The requested Doctor interview was not found.");
    }
    public static AccessApplicationException invalidReviewTransition(String message) {
        return new AccessApplicationException(HttpStatus.CONFLICT, "APPLICATION_REVIEW_TRANSITION_INVALID", message);
    }
    public static AccessApplicationException invalidInterviewTransition(String message) {
        return new AccessApplicationException(HttpStatus.CONFLICT, "DOCTOR_INTERVIEW_TRANSITION_INVALID", message);
    }
    public static AccessApplicationException validation(String message) {
        return new AccessApplicationException(HttpStatus.BAD_REQUEST, "APPLICATION_NOT_READY_FOR_REVIEW", message);
    }
    public static AccessApplicationException rateLimited(Duration retryAfter) {
        return new AccessApplicationException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many requests. Please try again later.", retryAfter);
    }
}
