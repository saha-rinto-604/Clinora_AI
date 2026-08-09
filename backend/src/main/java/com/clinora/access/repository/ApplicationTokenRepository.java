package com.clinora.access.repository;
import com.clinora.access.domain.ApplicationToken;
import com.clinora.access.domain.ApplicationTokenType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ApplicationTokenRepository extends JpaRepository<ApplicationToken, UUID> {
    Optional<ApplicationToken> findByTokenHashAndTokenType(String tokenHash, ApplicationTokenType tokenType);
    void deleteAllByApplicationIdAndTokenType(UUID applicationId, ApplicationTokenType tokenType);
}
