package com.clinora.notifications.api;

import com.clinora.common.api.ApiResponse;
import com.clinora.notifications.service.PatientNotificationService;
import com.clinora.notifications.service.PatientNotificationService.NotificationPage;
import com.clinora.notifications.service.PatientNotificationService.NotificationPreferences;
import com.clinora.notifications.service.PatientNotificationService.NotificationView;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

@Validated
@RestController
@RequestMapping("/api/v1/patient/notifications")
@PreAuthorize("hasRole('PATIENT')")
public class PatientNotificationController {
    private final PatientNotificationService notifications;

    public PatientNotificationController(PatientNotificationService notifications) {
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
        return ApiResponse.success("Notifications loaded.", notifications.list(userId(jwt), unreadOnly, before, beforeId, limit));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Long> unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Unread notification count loaded.", notifications.unreadCount(userId(jwt)));
    }

    @PostMapping("/{notificationId}/read")
    public ApiResponse<NotificationView> read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID notificationId) {
        return ApiResponse.success("Notification marked as read.", notifications.markRead(userId(jwt), notificationId));
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> readAll(@AuthenticationPrincipal Jwt jwt) {
        notifications.markAllRead(userId(jwt));
        return ApiResponse.success("Notifications marked as read.", null);
    }

    @GetMapping("/preferences")
    public ApiResponse<NotificationPreferences> preferences(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Notification preferences loaded.", notifications.preferences(userId(jwt)));
    }

    @PatchMapping("/preferences")
    public ApiResponse<NotificationPreferences> preferences(
        @AuthenticationPrincipal Jwt jwt,
        @RequestBody NotificationPreferences preferences
    ) {
        return ApiResponse.success("Notification preferences updated.", notifications.updatePreferences(userId(jwt), preferences));
    }

    private UUID userId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}

