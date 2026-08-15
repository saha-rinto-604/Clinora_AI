package com.clinora.access.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.clinora.access.api.AccessApplicationException;
import com.clinora.access.domain.ApplicationDocument;
import com.clinora.access.domain.ApplicationDocumentType;
import com.clinora.access.repository.AccessApplicationRepository;
import com.clinora.access.repository.ApplicationDocumentRepository;
import com.clinora.access.repository.ApplicationEventRepository;
import com.clinora.access.storage.ApplicationDocumentStoragePort;
import com.clinora.audit.AuthAuditService;
import com.clinora.config.AccessApplicationProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ApplicationDocumentAdminDownloadTest {

    @Test
    void downloadRequiresDocumentToBelongToApplicationBeforeReadingStorage() {
        UUID applicationId = UUID.randomUUID();
        UUID otherApplicationId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();
        ApplicationDocumentRepository documents = mock(ApplicationDocumentRepository.class);
        ApplicationDocumentStoragePort storage = mock(ApplicationDocumentStoragePort.class);
        ApplicationDocumentService service = new ApplicationDocumentService(
            mock(AccessApplicationRepository.class),
            documents,
            mock(ApplicationEventRepository.class),
            storage,
            new AccessApplicationProperties(),
            mock(AuthAuditService.class),
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

        assertArrayEquals(new byte[] {1, 2, 3}, service.download(applicationId, documentId).bytes());
        assertThrows(AccessApplicationException.class, () -> service.download(otherApplicationId, documentId));
    }
}
