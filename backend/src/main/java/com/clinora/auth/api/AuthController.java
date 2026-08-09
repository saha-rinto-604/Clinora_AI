package com.clinora.auth.api;

import com.clinora.auth.service.PatientAuthService;
import com.clinora.auth.service.PatientAuthService.AuthenticatedView;
import com.clinora.auth.service.PatientAuthService.RequestContext;
import com.clinora.auth.service.PatientAuthService.SessionResult;
import com.clinora.auth.service.PatientAuthService.SessionView;
import com.clinora.auth.service.PatientAuthService.UserView;
import com.clinora.auth.service.RefreshCookieService;
import com.clinora.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final PatientAuthService auth;
    private final RefreshCookieService cookies;

    public AuthController(PatientAuthService auth, RefreshCookieService cookies) {
        this.auth = auth;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    public ApiResponse<Map<String, String>> register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest http
    ) {
        String email = auth.register(
            request.firstName(),
            request.lastName(),
            request.email(),
            request.password(),
            context(http)
        );
        return ApiResponse.success(
            "Patient account created. Check your email to verify the account.",
            Map.of("email", email)
        );
    }

    @PostMapping("/verify-email")
    public ApiResponse<Void> verifyEmail(@Valid @RequestBody TokenRequest request, HttpServletRequest http) {
        auth.verifyEmail(request.token(), context(http));
        return ApiResponse.success("Email verified. You can now sign in.", null);
    }

    @PostMapping("/resend-verification")
    public ApiResponse<Void> resendVerification(
        @Valid @RequestBody EmailRequest request,
        HttpServletRequest http
    ) {
        auth.resendVerification(request.email(), context(http));
        return ApiResponse.success(
            "If the account is waiting for verification, a new email has been sent.",
            null
        );
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthenticatedView>> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest http
    ) {
        return sessionResponse(
            "Signed in successfully.",
            auth.login(request.email(), request.password(), context(http))
        );
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthenticatedView>> refresh(
        @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
        HttpServletRequest http
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw AuthApiException.sessionInvalid();
        }
        return sessionResponse("Session refreshed.", auth.refresh(refreshToken, context(http)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
        @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
        HttpServletRequest http
    ) {
        auth.logout(refreshToken, context(http));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookies.clear().toString())
            .body(ApiResponse.success("Signed out.", null));
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody EmailRequest request, HttpServletRequest http) {
        auth.forgotPassword(request.email(), context(http));
        return ApiResponse.success(
            "If an eligible account exists, a password reset email has been sent.",
            null
        );
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
        @Valid @RequestBody ResetPasswordRequest request,
        HttpServletRequest http
    ) {
        auth.resetPassword(request.token(), request.password(), context(http));
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookies.clear().toString())
            .body(ApiResponse.success("Password reset. Sign in with your new password.", null));
    }

    @PatchMapping("/change-password")
    public ResponseEntity<ApiResponse<AuthenticatedView>> changePassword(
        @AuthenticationPrincipal Jwt jwt,
        @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
        @Valid @RequestBody ChangePasswordRequest request,
        HttpServletRequest http
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw AuthApiException.sessionInvalid();
        }
        return sessionResponse(
            "Password changed securely.",
            auth.changePassword(
                userId(jwt),
                request.currentPassword(),
                request.newPassword(),
                refreshToken,
                context(http)
            )
        );
    }

    @GetMapping("/me")
    public ApiResponse<UserView> me(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success("Authenticated account.", auth.me(userId(jwt)));
    }

    @GetMapping("/sessions")
    public ApiResponse<List<SessionView>> sessions(
        @AuthenticationPrincipal Jwt jwt,
        @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken
    ) {
        return ApiResponse.success("Account sessions.", auth.sessions(userId(jwt), refreshToken));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ApiResponse<Void> revokeSession(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID sessionId,
        HttpServletRequest http
    ) {
        auth.revokeSession(userId(jwt), sessionId, context(http));
        return ApiResponse.success("Session revoked.", null);
    }

    @PostMapping("/sessions/revoke-others")
    public ApiResponse<Void> revokeOthers(
        @AuthenticationPrincipal Jwt jwt,
        @CookieValue(name = RefreshCookieService.COOKIE_NAME, required = false) String refreshToken,
        HttpServletRequest http
    ) {
        auth.revokeOthers(userId(jwt), refreshToken, context(http));
        return ApiResponse.success("Other sessions revoked.", null);
    }

    private ResponseEntity<ApiResponse<AuthenticatedView>> sessionResponse(String message, SessionResult result) {
        return ResponseEntity.ok()
            .header(
                HttpHeaders.SET_COOKIE,
                cookies.issue(result.refreshToken(), auth.refreshCookieMaxAge()).toString()
            )
            .body(ApiResponse.success(message, result.response()));
    }

    private UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private RequestContext context(HttpServletRequest request) {
        return new RequestContext(request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT));
    }

    public record RegisterRequest(
        @NotBlank @Size(max = 120) String firstName,
        @NotBlank @Size(max = 120) String lastName,
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(min = 8, max = 128) String password
    ) {
    }

    public record EmailRequest(@NotBlank @Email @Size(max = 320) String email) {
    }

    public record TokenRequest(@NotBlank @Size(max = 512) String token) {
    }

    public record LoginRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 128) String password
    ) {
    }

    public record ResetPasswordRequest(
        @NotBlank @Size(max = 512) String token,
        @NotBlank @Size(min = 8, max = 128) String password
    ) {
    }

    public record ChangePasswordRequest(
        @NotBlank @Size(max = 128) String currentPassword,
        @NotBlank @Size(min = 8, max = 128) String newPassword
    ) {
    }
}
