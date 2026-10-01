package com.clinora.research.exception;

import org.springframework.http.HttpStatus;

public class ResearchApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public ResearchApiException(HttpStatus status, String errorCode, String message) {
        super(message);
        this.status = status;
        this.errorCode = errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
