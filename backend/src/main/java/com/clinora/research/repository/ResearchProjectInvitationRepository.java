package com.clinora.research.repository;

import com.clinora.research.domain.InvitationStatus;
import com.clinora.research.domain.ResearchProjectInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ResearchProjectInvitationRepository extends JpaRepository<ResearchProjectInvitation, UUID> {

    List<ResearchProjectInvitation> findByProjectIdOrderByInvitedAtDesc(UUID projectId);

    /** Invitations received by a researcher (their inbox). */
    List<ResearchProjectInvitation> findByInviteeUserIdAndStatusOrderByInvitedAtDesc(
            UUID inviteeUserId, InvitationStatus status);

    /** All invitations received by a researcher across statuses. */
    List<ResearchProjectInvitation> findByInviteeUserIdOrderByInvitedAtDesc(UUID inviteeUserId);

    /** Check for existing pending invitation (prevents duplicates). */
    Optional<ResearchProjectInvitation> findByProjectIdAndInviteeUserIdAndStatus(
            UUID projectId, UUID inviteeUserId, InvitationStatus status);

    /** Expire all overdue pending invitations in bulk. */
    @Query("SELECT i FROM ResearchProjectInvitation i " +
           "WHERE i.status = 'PENDING' AND i.expiresAt < :now")
    List<ResearchProjectInvitation> findExpiredPending(@Param("now") Instant now);
}
