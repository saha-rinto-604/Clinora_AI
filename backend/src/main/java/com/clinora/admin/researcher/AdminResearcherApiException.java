package com.clinora.admin.researcher;

import org.springframework.http.HttpStatus;

public class AdminResearcherApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public AdminResearcherApiException(HttpStatus status, String errorCode, String message) {
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
