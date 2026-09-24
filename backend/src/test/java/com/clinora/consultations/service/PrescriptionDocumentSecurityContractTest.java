package com.clinora.consultations.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class PrescriptionDocumentSecurityContractTest {
    @Test
    void prescriptionDocumentsStayPrivateBoundedAndSerializedWithConsultationCompletion() throws IOException {
        String source = source("src/main/java/com/clinora/consultations/service/PrescriptionDocumentService.java");

        assertTrue(source.contains("private static final int MAX_DOCUMENTS = 5"));
        assertTrue(source.contains("FOR UPDATE"));
        assertTrue(source.contains("malwareScanner.scan(file)"));
        assertTrue(source.contains("securityProperties.isFailClosed()"));
        assertTrue(source.contains("sha256(stored.bytes())"));
        assertTrue(source.contains("c.status = 'COMPLETED'"));
        assertTrue(source.contains("consultation-prescriptions/"));
        assertTrue(source.contains("deleteObjectIfTransactionRollsBack"));
        assertTrue(source.contains("deleteObjectAfterCommit"));
        assertFalse(source.contains("patient-reports/"));
    }

    private String source(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8).replace("\r\n", "\n");
    }
}
