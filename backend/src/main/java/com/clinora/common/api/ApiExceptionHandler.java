package com.clinora.common.api;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.auth.api.AuthApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(AuthApiException.class)
    public ResponseEntity<ApiError> handleAuth(AuthApiException exception) {
        HttpHeaders headers = new HttpHeaders();
        if (!exception.getRetryAfter().isZero() && !exception.getRetryAfter().isNegative()) {
            headers.set(
                HttpHeaders.RETRY_AFTER,
                Long.toString(Math.max(1, exception.getRetryAfter().toSeconds()))
            );
        }
        return ResponseEntity
            .status(exception.getStatus())
            .headers(headers)
            .body(new ApiError(false, exception.getMessage(), exception.getErrorCode(), Map.of()));
    }


    @ExceptionHandler(AccessApplicationException.class)
    public ResponseEntity<ApiError> handleAccessApplication(AccessApplicationException exception) {
        HttpHeaders headers = new HttpHeaders();
        if (!exception.getRetryAfter().isZero() && !exception.getRetryAfter().isNegative()) {
            headers.set(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(1, exception.getRetryAfter().toSeconds())));
        }
        return ResponseEntity.status(exception.getStatus()).headers(headers)
            .body(new ApiError(false, exception.getMessage(), exception.getErrorCode(), Map.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
            fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage())
        );
        return ResponseEntity.badRequest().body(
            new ApiError(false, "Please correct the highlighted fields.", "VALIDATION_FAILED", fieldErrors)
        );
    }

    public record ApiError(
        boolean success,
        String message,
        String errorCode,
        Map<String, String> fieldErrors
    ) {
    }
}
