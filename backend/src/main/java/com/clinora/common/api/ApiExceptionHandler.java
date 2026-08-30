package com.clinora.common.api;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.auth.api.AuthApiException;
import com.clinora.patients.api.PatientApiException;
import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

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


    @ExceptionHandler(PatientApiException.class)
    public ResponseEntity<ApiError> handlePatient(PatientApiException exception) {
        return ResponseEntity.status(exception.getStatus())
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

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getConstraintViolations().forEach(violation ->
            fieldErrors.putIfAbsent(violation.getPropertyPath().toString(), violation.getMessage())
        );
        return ResponseEntity.badRequest().body(
            new ApiError(false, "Please correct the highlighted fields.", "VALIDATION_FAILED", fieldErrors)
        );
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException exception) {
        return ResponseEntity.badRequest().body(
            new ApiError(
                false,
                "Medical reports must be 20 MB or smaller.",
                "REPORT_FILE_TOO_LARGE",
                Map.of()
            )
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
