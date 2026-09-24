package com.clinora.consultations.api;

import com.clinora.consultations.service.PrescriptionDocumentService;
import com.clinora.consultations.service.PrescriptionDocumentService.DocumentContent;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient/consultations/{consultationId}/prescription-documents")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPrescriptionDocumentController {
    private final PrescriptionDocumentService documents;

    public PatientPrescriptionDocumentController(PrescriptionDocumentService documents) {
        this.documents = documents;
    }

    @GetMapping("/{documentId}/content")
    public ResponseEntity<byte[]> content(
        @AuthenticationPrincipal Jwt jwt,
        @PathVariable UUID consultationId,
        @PathVariable UUID documentId,
        @RequestParam(defaultValue = "view") String disposition,
        HttpServletRequest request
    ) {
        boolean download = "download".equalsIgnoreCase(disposition);
        DocumentContent content = documents.patientContent(
            userId(jwt),
            consultationId,
            documentId,
            download,
            clientIp(request),
            request.getHeader("User-Agent")
        );
        ContentDisposition contentDisposition = download
            ? ContentDisposition.attachment().filename(content.filename(), StandardCharsets.UTF_8).build()
            : ContentDisposition.inline().filename(content.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString())
            .header("X-Content-Type-Options", "nosniff")
            .contentType(MediaType.parseMediaType(content.contentType()))
            .contentLength(content.bytes().length)
            .body(content.bytes());
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
