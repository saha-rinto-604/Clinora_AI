package com.clinora.research.api;

import com.clinora.research.domain.ProjectMemberRole;
import com.clinora.research.service.ResearchAuthorizationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Controller
public class ResearchDocumentCollaborationController {

    private static final Logger log = LoggerFactory.getLogger(ResearchDocumentCollaborationController.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ResearchAuthorizationService authz;
    private final com.clinora.research.service.ResearchAccessGuard guard;
    private final com.clinora.users.repository.UserAccountRepository users;

    public ResearchDocumentCollaborationController(
            SimpMessagingTemplate messagingTemplate,
            ResearchAuthorizationService authz, com.clinora.research.service.ResearchAccessGuard guard,
            com.clinora.users.repository.UserAccountRepository users
    ) {
        this.messagingTemplate = messagingTemplate;
        this.authz = authz;
        this.guard = guard;
        this.users = users;
    }

    public record DocumentEditMessage(
            UUID senderUserId,
            String senderName,
            String crdtUpdateBase64,
            String contentJson
    ) {}

    public record DocumentPresenceMessage(
            UUID userId,
            String name,
            String color,
            String status,
            Instant timestamp
    ) {}

    @MessageMapping("/research/projects/{projectId}/documents/{documentId}/edit")
    public void handleDocumentEdit(
            @DestinationVariable UUID projectId,
            @DestinationVariable UUID documentId,
            @Payload DocumentEditMessage message,
            Principal principal
    ) {
        throw new org.springframework.security.access.AccessDeniedException("Use revision-checked document saves. Live content broadcasting is unavailable.");
    }

    @MessageMapping("/research/projects/{projectId}/documents/{documentId}/presence")
    public void handlePresence(
            @DestinationVariable UUID projectId,
            @DestinationVariable UUID documentId,
            @Payload DocumentPresenceMessage message,
            Principal principal
    ) {
        UUID userId = extractUserId(principal);
        if (userId == null) return;

        guard.document(projectId, documentId, userId, false);
        // Verify read access to the project
        try {
            authz.requireReadAccess(projectId, userId);
        } catch (Exception e) {
            log.warn("Unauthorized presence message for user {} in project {}", userId, projectId);
            return;
        }

        String destination = "/topic/research.projects." + projectId + ".documents." + documentId + ".presence";
        var user = users.findById(userId).orElseThrow();
        String name = user.getFirstName() + " " + user.getLastName();
        messagingTemplate.convertAndSend(destination,
            new DocumentPresenceMessage(userId, name, "#22d3ee", "viewing", Instant.now()));
    }

    private UUID extractUserId(Principal principal) {
        if (principal == null) return null;
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof Jwt jwt) {
            return UUID.fromString(jwt.getSubject());
        }
        return null;
    }
}
