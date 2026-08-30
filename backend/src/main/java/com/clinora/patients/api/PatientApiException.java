package com.clinora.patients.api;

import org.springframework.http.HttpStatus;

public class PatientApiException extends RuntimeException {

    private final HttpStatus status;
    private final String errorCode;

    public PatientApiException(HttpStatus status, String errorCode, String message) {
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
