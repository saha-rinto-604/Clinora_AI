package com.clinora.notifications.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.notifications.service.DoctorNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationPage;
import com.clinora.notifications.service.PatientNotificationService.NotificationView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/doctor/notifications")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorNotificationController {
    private final DoctorNotificationService notifications;

    public DoctorNotificationController(DoctorNotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public ApiResponse<NotificationPage> list(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "false") boolean unreadOnly,
        @RequestParam(required = false) Instant before,
        @RequestParam(required = false) UUID beforeId,
        @RequestParam(defaultValue = "30") @Min(1) @Max(50) int limit
    ) {
        return ApiResponse.success("Doctor notifications loaded.", notifications.list(userId(jwt), unreadOnly, before, beforeId, limit));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Unread Doctor notification count loaded.", notifications.unreadCount(userId(jwt)));
    }

    @PostMapping("/{notificationId}/read")
    public ApiResponse<NotificationView> read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID notificationId) {
        return ApiResponse.success("Doctor notification marked as read.", notifications.markRead(userId(jwt), notificationId));
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> readAll(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(userId(jwt));
        return ApiResponse.success("Doctor notifications marked as read.", null);
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
