package com.clinora.auth.session;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthSessionRepository extends JpaRepository<AuthSession, UUID> {

    List<AuthSession> findAllByUser_IdAndRevokedAtIsNull(UUID userId);

    Optional<AuthSession> findByIdAndUser_Id(UUID sessionId, UUID userId);
}
