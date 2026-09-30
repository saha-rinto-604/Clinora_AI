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

    public ResearchDocumentCollaborationController(
            SimpMessagingTemplate messagingTemplate,
            ResearchAuthorizationService authz
    ) {
        this.messagingTemplate = messagingTemplate;
        this.authz = authz;
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
        UUID userId = extractUserId(principal);
        if (userId == null) {
            log.warn("Unauthenticated document edit message rejected for project {}", projectId);
            return;
        }

        ProjectMemberRole role = authz.resolveProjectRole(projectId, userId).orElse(null);
        if (role == null || role == ProjectMemberRole.VIEWER) {
            log.warn("Unauthorized document edit message rejected for user {} in project {}", userId, projectId);
            return;
        }

        // Broadcast CRDT update to all collaborators currently viewing this document
        String destination = "/topic/research/projects/" + projectId + "/documents/" + documentId;
        messagingTemplate.convertAndSend(destination, message);
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

        // Verify read access to the project
        try {
            authz.requireReadAccess(projectId, userId);
        } catch (Exception e) {
            log.warn("Unauthorized presence message for user {} in project {}", userId, projectId);
            return;
        }

        String destination = "/topic/research/projects/" + projectId + "/documents/" + documentId + "/presence";
        messagingTemplate.convertAndSend(destination, message);
    }

    private UUID extractUserId(Principal principal) {
        if (principal == null) return null;
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof Jwt jwt) {
            return UUID.fromString(jwt.getSubject());
        }
        try {
            return UUID.fromString(principal.getName());
        } catch (Exception e) {
            return null;
        }
    }
}
