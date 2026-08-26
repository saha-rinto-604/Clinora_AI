package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.ApplicationDocument;
import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditAction;
import com.clinora.audit.AuthAuditOutcome;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ApplicationDocumentAdminDownloadTest {

    @Test
    void downloadRequiresDocumentToBelongToApplicationBeforeReadingStorage() {
        UUID applicationId = UUID.randomUUID();
        UUID otherApplicationId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        ApplicationDocumentRepository documents = mock(ApplicationDocumentRepository.class);
        ApplicationDocumentStoragePort storage = mock(ApplicationDocumentStoragePort.class);
        AuthAuditService audit = mock(AuthAuditService.class);
        ApplicationDocumentService service = new ApplicationDocumentService(
            mock(AccessApplicationRepository.class),
            documents,
            mock(ApplicationEventRepository.class),
            storage,
            new AccessApplicationProperties(),
            audit,
            Clock.systemUTC()
        );
        ApplicationDocument doc = new ApplicationDocument(
            applicationId,
            ApplicationDocumentType.CV,
            "applications/private/doc.pdf",
            "cv.pdf",
            "application/pdf",
            4,
            "checksum",
            Instant.parse("2026-08-15T12:00:00Z")
        );
        when(documents.findByIdAndApplicationId(documentId, applicationId)).thenReturn(Optional.of(doc));
        when(documents.findByIdAndApplicationId(documentId, otherApplicationId)).thenReturn(Optional.empty());
        when(storage.get("applications/private/doc.pdf")).thenReturn(
            new ApplicationDocumentStoragePort.StoredObject(new byte[] {1, 2, 3}, "application/pdf")
        );

        var download = service.downloadForAdmin(applicationId, documentId, UUID.randomUUID(), "127.0.0.1", "JUnit");

        assertArrayEquals(new byte[] {1, 2, 3}, download.bytes());
        assertEquals("application/pdf", download.contentType());
        assertEquals("cv.pdf", download.filename());
        verify(audit).record(
            org.mockito.ArgumentMatchers.any(),
            eq(AuthAuditAction.ACCESS_APPLICATION_DOCUMENT_VIEWED),
            eq(AuthAuditOutcome.SUCCESS),
            eq("127.0.0.1"),
            eq("JUnit"),
            eq(applicationId.toString()),
            eq("documentId=" + documentId + ";type=CV")
        );
        AccessApplicationException missing = assertThrows(
            AccessApplicationException.class,
            () -> service.downloadForAdmin(otherApplicationId, documentId, UUID.randomUUID(), null, null)
        );
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatus());
        assertEquals("APPLICATION_DOCUMENT_NOT_FOUND", missing.getErrorCode());
        verify(storage, org.mockito.Mockito.times(1)).get("applications/private/doc.pdf");
    }
}
