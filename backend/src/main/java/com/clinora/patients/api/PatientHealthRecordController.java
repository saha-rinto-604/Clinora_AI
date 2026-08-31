package com.clinora.patients.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.patients.service.PatientHealthRecordService;
import com.clinora.patients.service.PatientHealthRecordService.HealthRecordView;
import com.clinora.patients.service.PatientBodyMeasurementService;
import com.clinora.patients.service.PatientBodyMeasurementService.HealthTrendView;
import com.clinora.patients.service.PatientTimelineService;
import com.clinora.patients.service.PatientTimelineService.TimelineCategory;
import com.clinora.patients.service.PatientTimelineService.TimelinePage;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

@Validated
@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientHealthRecordController {
    private final PatientHealthRecordService healthRecord;
    private final PatientTimelineService timeline;
    private final PatientBodyMeasurementService measurements;

    public PatientHealthRecordController(
        PatientHealthRecordService healthRecord,
        PatientTimelineService timeline,
        PatientBodyMeasurementService measurements
    ) {
        this.healthRecord = healthRecord;
        this.timeline = timeline;
        this.measurements = measurements;
    }

    @GetMapping("/history")
    public ApiResponse<HealthRecordView> history(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Health record loaded.", healthRecord.record(userId(jwt)));
    }

    @GetMapping("/health-trends")
    public ApiResponse<HealthTrendView> healthTrends(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        return ApiResponse.success("Health trends loaded.", measurements.trends(userId(jwt), from, to));
    }

    @GetMapping("/timeline")
    public ApiResponse<TimelinePage> timeline(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(required = false) TimelineCategory category,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant before,
        @RequestParam(required = false) UUID beforeId,
        @RequestParam(defaultValue = "30") @Min(1) @Max(50) int limit
    ) {
        return ApiResponse.success("Health timeline loaded.", timeline.list(userId(jwt), category, before, beforeId, limit));
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
