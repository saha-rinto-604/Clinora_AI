package com.clinora.access.api;

import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.domain.ApplicationType;
import com.clinora.access.service.AccessApplicationModels;
import com.clinora.access.service.AccessApplicationService;
import com.clinora.access.service.AccessRateLimitGuard;
import com.clinora.access.service.ApplicantOriginGuard;
import com.clinora.access.service.ApplicantSessionService;
import com.clinora.access.service.ApplicationDocumentService;
import com.clinora.common.api.ApiResponse;
import com.clinora.config.AccessApplicationProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/access-applications")
public class AccessApplicationController {

    private final AccessApplicationService applications;
    private final ApplicationDocumentService documents;
    private final ApplicantSessionService sessions;
    private final AccessRateLimitGuard rateLimits;
    private final ApplicantOriginGuard originGuard;
    private final AccessApplicationProperties properties;

    public AccessApplicationController(
        AccessApplicationService applications,
        ApplicationDocumentService documents,
        ApplicantSessionService sessions,
        AccessRateLimitGuard rateLimits,
        ApplicantOriginGuard originGuard,
        AccessApplicationProperties properties
    ) {
        this.applications = applications;
        this.documents = documents;
        this.sessions = sessions;
        this.rateLimits = rateLimits;
        this.originGuard = originGuard;
        this.properties = properties;
    }

    @PostMapping("/doctor")
    public ApiResponse<Void> createDoctor(@Valid @RequestBody CreateApplicationRequest body, HttpServletRequest request) {
        rateLimits.create(ip(request), body.email().trim().toLowerCase(java.util.Locale.ROOT));
        applications.create(ApplicationType.DOCTOR, body.toModel(), ip(request), userAgent(request));
        return ApiResponse.success("Check your email to verify and continue your Doctor access application.", null);
    }

    @PostMapping("/researcher")
    public ApiResponse<Void> createResearcher(@Valid @RequestBody CreateApplicationRequest body, HttpServletRequest request) {
        rateLimits.create(ip(request), body.email().trim().toLowerCase(java.util.Locale.ROOT));
        applications.create(ApplicationType.RESEARCHER, body.toModel(), ip(request), userAgent(request));
        return ApiResponse.success("Check your email to verify and continue your Researcher access application.", null);
    }

    @PostMapping("/verify-email")
    public ApiResponse<AccessApplicationModels.VerificationResult> verifyEmail(
        @Valid @RequestBody TokenRequest body,
        HttpServletRequest request
    ) {
        rateLimits.verify(ip(request));
        var result = applications.verifyEmail(body.token(), ip(request), userAgent(request));
        return ApiResponse.success("Email verified. Continue to establish secure applicant access.", result);
    }

    @PostMapping("/verify-email/resend")
    public ApiResponse<Void> resendVerification(
        @Valid @RequestBody TokenRequest body,
        HttpServletRequest request
    ) {
        rateLimits.verify(ip(request));
        applications.resendVerification(body.token(), ip(request), userAgent(request));
        return ApiResponse.success("A new verification email has been sent if this application can still be verified.", null);
    }

    @PostMapping("/access-link")
    public ApiResponse<Void> requestAccessLink(@Valid @RequestBody AccessLinkRequest body, HttpServletRequest request) {
        rateLimits.accessLink(body.email().trim().toLowerCase(java.util.Locale.ROOT));
        applications.requestAccessLink(body.email(), ip(request), userAgent(request));
        return ApiResponse.success(
            "If an eligible application exists for that email, a secure resume link has been sent.",
            null
        );
    }

    @PostMapping("/session")
    public ResponseEntity<ApiResponse<Void>> establishSession(
        @Valid @RequestBody TokenRequest body,
        HttpServletRequest request
    ) {
        rateLimits.session(ip(request));
        var issued = applications.establishSession(body.token(), ip(request), userAgent(request));
        return withApplicantCookie("Secure applicant session established.", issued);
    }

    @GetMapping("/me")
    public ApiResponse<AccessApplicationModels.ApplicationView> me(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie
    ) {
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success("Application loaded.", applications.get(applicationId));
    }

    @PatchMapping("/me")
    public ApiResponse<AccessApplicationModels.ApplicationView> update(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        @Valid @RequestBody UpdateApplicationRequest body
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success("Application progress saved.", applications.update(applicationId, body.toModel()));
    }

    @GetMapping("/me/events")
    public ApiResponse<List<AccessApplicationModels.EventView>> events(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie
    ) {
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success("Application updates loaded.", applications.events(applicationId));
    }

    @PostMapping(value = "/me/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AccessApplicationModels.DocumentView> uploadDocument(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        @RequestParam ApplicationDocumentType documentType,
        @RequestPart("file") MultipartFile file,
        HttpServletRequest request
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        rateLimits.upload(applicationId.toString());
        return ApiResponse.success(
            "Document uploaded securely.",
            documents.upload(applicationId, documentType, file, ip(request), userAgent(request))
        );
    }

    @GetMapping("/me/documents/{documentId}/content")
    public ResponseEntity<byte[]> downloadDocument(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @org.springframework.web.bind.annotation.PathVariable java.util.UUID documentId
    ) {
        var applicationId = sessions.requireApplication(cookie);
        var download = documents.download(applicationId, documentId);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(download.contentType()))
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment()
                    .filename(download.filename(), StandardCharsets.UTF_8)
                    .build()
                    .toString()
            )
            .body(download.bytes());
    }

    @DeleteMapping("/me/documents/{documentId}")
    public ApiResponse<Void> deleteDocument(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        @org.springframework.web.bind.annotation.PathVariable java.util.UUID documentId,
        HttpServletRequest request
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        documents.delete(applicationId, documentId, ip(request), userAgent(request));
        return ApiResponse.success("Document removed.", null);
    }

    @PostMapping("/me/submit")
    public ApiResponse<AccessApplicationModels.ApplicationView> submit(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        @Valid @RequestBody SubmitRequest body,
        HttpServletRequest request
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        rateLimits.submit(applicationId.toString());
        return ApiResponse.success(
            "Application submitted for professional access review.",
            applications.submit(applicationId, body.confirmedAccurate(), ip(request), userAgent(request))
        );
    }

    @PostMapping("/me/withdraw")
    public ApiResponse<AccessApplicationModels.ApplicationView> withdraw(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin,
        HttpServletRequest request
    ) {
        originGuard.requireAllowed(origin);
        var applicationId = sessions.requireApplication(cookie);
        return ApiResponse.success(
            "Application withdrawn.",
            applications.withdraw(applicationId, ip(request), userAgent(request))
        );
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
        @CookieValue(name = ApplicantSessionService.COOKIE_NAME, required = false) String cookie,
        @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin
    ) {
        originGuard.requireAllowed(origin);
        sessions.revoke(cookie);
        ResponseCookie cleared = ResponseCookie.from(ApplicantSessionService.COOKIE_NAME, "")
            .httpOnly(true)
            .secure(properties.isCookieSecure())
            .sameSite(properties.getCookieSameSite())
            .path("/api/v1/access-applications")
            .maxAge(0)
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cleared.toString())
            .body(ApiResponse.success("Applicant session ended.", null));
    }

    private ResponseEntity<ApiResponse<Void>> withApplicantCookie(
        String message,
        ApplicantSessionService.IssuedApplicantSession issued
    ) {
        ResponseCookie cookie = ResponseCookie.from(ApplicantSessionService.COOKIE_NAME, issued.rawCookieValue())
            .httpOnly(true)
            .secure(properties.isCookieSecure())
            .sameSite(properties.getCookieSameSite())
            .path("/api/v1/access-applications")
            .maxAge(issued.ttl())
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie.toString())
            .body(ApiResponse.success(message, null));
    }

    private String ip(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }

    public record CreateApplicationRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        @NotBlank String phone,
        @NotBlank String countryCode,
        boolean consentToApplicationProcessing
    ) {
        AccessApplicationModels.CreateRequest toModel() {
            return new AccessApplicationModels.CreateRequest(firstName, lastName, email, phone, countryCode, consentToApplicationProcessing);
        }
    }

    public record TokenRequest(@NotBlank String token) {
    }

    public record AccessLinkRequest(@NotBlank @Email String email) {
    }

    public record QualificationRequest(
        @NotBlank String qualificationName,
        @NotBlank String institution,
        @NotBlank String countryCode,
        Integer completionYear
    ) {
        AccessApplicationModels.QualificationInput toModel() {
            return new AccessApplicationModels.QualificationInput(
                qualificationName,
                institution,
                countryCode,
                completionYear
            );
        }
    }

    public record UpdateApplicationRequest(
        String firstName,
        String lastName,
        String phone,
        String countryCode,
        String professionalTitle,
        String specialization,
        Integer yearsExperience,
        String currentOrganization,
        String currentPosition,
        String professionalProfileUrl,
        String registrationJurisdiction,
        String registrationAuthority,
        String registrationNumber,
        String registrationType,
        LocalDate registrationIssuedAt,
        LocalDate registrationValidUntil,
        List<@Valid QualificationRequest> qualifications,
        String institution,
        String department,
        String institutionalProfileUrl,
        String researchField,
        String researchPurpose,
        String researchSummary,
        String orcid,
        String researchProfileUrl,
        String publicationProfileUrl,
        String ethicsReference,
        String projectApprovalReference
    ) {
        AccessApplicationModels.UpdateRequest toModel() {
            List<AccessApplicationModels.QualificationInput> qualificationModels = qualifications == null
                ? null
                : qualifications.stream().map(QualificationRequest::toModel).toList();
            return new AccessApplicationModels.UpdateRequest(
                firstName,
                lastName,
                phone,
                countryCode,
                professionalTitle,
                specialization,
                yearsExperience,
                currentOrganization,
                currentPosition,
                professionalProfileUrl,
                registrationJurisdiction,
                registrationAuthority,
                registrationNumber,
                registrationType,
                registrationIssuedAt,
                registrationValidUntil,
                qualificationModels,
                institution,
                department,
                institutionalProfileUrl,
                researchField,
                researchPurpose,
                researchSummary,
                orcid,
                researchProfileUrl,
                publicationProfileUrl,
                ethicsReference,
                projectApprovalReference
            );
        }
    }

    public record SubmitRequest(boolean confirmedAccurate) {
    }
}
