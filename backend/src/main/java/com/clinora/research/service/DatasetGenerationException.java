package com.clinora.research.service;

public class DatasetGenerationException extends RuntimeException {
    private final String code;

    public DatasetGenerationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public DatasetGenerationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
