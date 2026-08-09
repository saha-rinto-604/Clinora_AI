package com.clinora.access.repository;
import com.clinora.access.domain.ApplicationDocument;
import com.clinora.access.domain.ApplicationDocumentType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ApplicationDocumentRepository extends JpaRepository<ApplicationDocument, UUID> {
    List<ApplicationDocument> findAllByApplicationIdOrderByCreatedAt(UUID applicationId);
    Optional<ApplicationDocument> findByIdAndApplicationId(UUID id, UUID applicationId);
    long countByApplicationIdAndDocumentType(UUID applicationId, ApplicationDocumentType documentType);
}
